import { useEffect, useRef, useState } from 'react';
import './home.css';
import { message } from 'antd';
import backgroudImg from '../../assets/img/title_bg.png';
import { BorderBox11, BorderBox7 } from '@jiaminghi/data-view-react';
import PieChart from '../../components/echarts/pieChart';
import LineChart from '../../components/echarts/lineChart';
import DataTable from '../../components/home/table';

function HomeIndex() {
	const iframeRef = useRef(null);
	// const [iframeSrc, setIframeSrc] = useState('http://127.16.2.100:5000');
	const [iframeSrc, setIframeSrc] = useState('http://localhost:5004/');
	const [uploading, setUploading] = useState(false);
	const [apiReady, setApiReady] = useState(false);

	// postMessage通信相关
	const messageIdRef = useRef(0);
	const pendingCallbacks = useRef(new Map());


	// 简化的消息监听 - 只处理必要的消息
	useEffect(() => {
		const handleMessage = (event) => {
			// 基本的来源检查
			if (!event.origin.includes('localhost') &&
				!event.origin.includes('localhost') &&
				!event.origin.includes('localhost')) {
				return;
			}

			// 忽略非对象消息
			if (!event.data || typeof event.data !== 'object') {
				return;
			}

			const { messageId, type, data, error } = event.data;

			// 处理VTK就绪通知
			if (type === 'vtk-ready') {
				console.log('VTK已就绪');
				setApiReady(true);
				message.success('VTK Viewer 连接成功');
				return;
			}

			// 处理API调用响应
			if (messageId && pendingCallbacks.current.has(messageId)) {
				const { resolve, reject } = pendingCallbacks.current.get(messageId);
				pendingCallbacks.current.delete(messageId);

				if (error) {
					reject(new Error(error));
				} else {
					resolve(data);
				}
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// 发送消息到VTK
	const sendToVTK = (action, data) => {
		return new Promise((resolve, reject) => {
			if (!iframeRef.current) {
				reject(new Error('VTK未加载'));
				return;
			}

			if (!apiReady) {
				reject(new Error('VTK未就绪'));
				return;
			}

			const messageId = ++messageIdRef.current;
			pendingCallbacks.current.set(messageId, { resolve, reject });

			// 发送消息
			try {
				iframeRef.current.contentWindow.postMessage({
					messageId,
					action,
					data
				}, '*');
			} catch (e) {
				pendingCallbacks.current.delete(messageId);
				reject(new Error('发送失败: ' + e.message));
				return;
			}

			// 10秒超时
			setTimeout(() => {
				if (pendingCallbacks.current.has(messageId)) {
					pendingCallbacks.current.delete(messageId);
					reject(new Error('请求超时'));
				}
			}, 10000);
		});
	};

	// API方法
	const vtkAPI = {
		uploadFile: async (file) => {
			const arrayBuffer = await file.arrayBuffer();
			return await sendToVTK('upload-file', {
				name: file.name,
				data: Array.from(new Uint8Array(arrayBuffer)),
				type: file.type || 'application/octet-stream'
			});
		},

		getSimulationData: () => sendToVTK('get-simulation-data', {}),
		resetView: () => sendToVTK('reset-view', {}),
		clearHighlights: () => sendToVTK('clear-highlights', {}),
		getStatus: () => sendToVTK('get-status', {})
	};

	// iframe加载完成
	const handleIframeLoad = () => {
		console.log('iframe已加载，等待VTK就绪...');
		// 不做任何主动检查，等待VTK主动发送就绪消息
	};


	// 文件上传
	const handleFileUpload = async (event) => {
		const file = event.target.files?.[0];
		if (!file) {
			message.error('请选择文件');
			return;
		}
		if (!apiReady) {
			message.error('VTK未就绪，请等待连接');
			return;
		}
		try {
			setUploading(true);
			message.loading({ content: '正在上传文件...', key: 'upload' });

			const result = await vtkAPI.uploadFile(file);

			if (result && result.success) {
				message.success({ content: '文件上传成功', key: 'upload' });

				// 获取仿真数据
				try {
					const simData = await vtkAPI.getSimulationData();
					console.log('仿真数据:', simData);
				} catch (e) {
					console.log('获取仿真数据失败:', e.message);
				}
			} else {
				message.error({
					content: `上传失败: ${result?.error || '未知错误'}`,
					key: 'upload'
				});
			}
		} catch (e) {
			message.error({ content: `上传失败：${e.message}`, key: 'upload' });
		} finally {
			setUploading(false);
			event.target.value = '';
		}
	};


	// 测试按钮
	const handleResetView = async () => {
		if (!apiReady) {
			message.warning('VTK未就绪');
			return;
		}

		try {
			await vtkAPI.resetView();
			message.success('视图已重置');
		} catch (e) {
			message.error('重置视图失败: ' + e.message);
		}
	};

	const handleClearHighlights = async () => {
		if (!apiReady) {
			message.warning('VTK未就绪');
			return;
		}

		try {
			await vtkAPI.clearHighlights();
			message.success('高亮已清除');
		} catch (e) {
			message.error('清除高亮失败: ' + e.message);
		}
	};

	return (
		<div className='HomeView'>
			<div className='title'>
				<img className='title_bg' src={backgroudImg} alt='' />
				<span className='title_txt'>航空发动机结冰风洞可视化平台</span>
			</div>

			{/* 按钮操作 */}
			<div className='btnArr'>
				<div className='btn' onClick={handleResetView}>
					重置视图
				</div>
				<div className='btn' onClick={handleClearHighlights}>
					清除高亮
				</div>
				<div className='btn'>
					<label htmlFor="fileInput" style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						上传VTK文件 {uploading && '(上传中...)'}
					</label>
					<input
						type="file"
						id="fileInput"
						accept=".vtk,.vtp,.vtu"
						style={{ display: 'none' }}
						onChange={handleFileUpload}
						disabled={!apiReady || uploading}
					/>
				</div>
			</div>

			{/* 左侧数据 */}
			<div className='leftBox'>
				<BorderBox11
					className='leftTop'
					title='冰风洞参数'
					style={{ width: 480, height: 400 }}
					color={['#11D6E0', '#037cb1']}
				>
					<div
						style={{
							display: 'flex',
							flexWrap: 'wrap',
							justifyContent: 'space-between',
						}}
					>
						<BorderBox7 className='Top1data'>
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									alignItems: 'center',
									height: '100%',
								}}
							>
								<div>连接状态</div>
								<div style={{ color: apiReady ? '#2ecc71' : '#e74c3c' }}>
									{apiReady ? '已连接' : '未连接'}
								</div>
							</div>
						</BorderBox7>
						<BorderBox7 className='Top1data'>
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									alignItems: 'center',
									height: '100%',
								}}
							>
								<div>通信方式</div>
								<div>postMessage</div>
							</div>
						</BorderBox7>
						<BorderBox7 className='Top1data'>
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									alignItems: 'center',
									height: '100%',
								}}
							>
								<div>类型</div>
								<div>VTK</div>
							</div>
						</BorderBox7>
						<BorderBox7 className='Top1data'>
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									alignItems: 'center',
									height: '100%',
								}}
							>
								<div>编号</div>
								<div>2025</div>
							</div>
						</BorderBox7>
					</div>
				</BorderBox11>

				<BorderBox11
					className='leftBottom'
					title='冰风洞环境模拟参数'
					style={{ width: 480, height: 450 }}
					color={['#11D6E0', '#037cb1']}
				>
					<DataTable />
				</BorderBox11>
			</div>

			{/* 中间模型 */}
			<div className='centerBox'>
				<iframe
					ref={iframeRef}
					style={{ width: 880, height: 600 }}
					src={iframeSrc}
					onLoad={handleIframeLoad}
					title="VTK Viewer"
				></iframe>
			</div>

			{/* 右侧数据 */}
			<div className='rightBox'>
				<BorderBox11
					className='rightTop'
					title='仪表盘'
					style={{ width: 480, height: 400 }}
					color={['#11D6E0', '#037cb1']}
				>
					<PieChart />
				</BorderBox11>

				<BorderBox11
					className='rightBottom'
					title='波形图'
					style={{ width: 480, height: 450 }}
					color={['#11D6E0', '#037cb1']}
				>
					<LineChart />
				</BorderBox11>
			</div>
		</div>
	);
}

export default HomeIndex;