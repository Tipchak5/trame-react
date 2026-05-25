import { useEffect, useRef, useState } from 'react';
import './home.css';
import Viewer from './modelndex';
import { message } from 'antd';
import backgroudImg from '../../assets/img/title_bg.png';
import { BorderBox11, BorderBox7 } from '@jiaminghi/data-view-react';
import PieChart from '../../components/echarts/pieChart';
import LineChart from '../../components/echarts/lineChart';
import DataTable from '../../components/home/table';
import BFD from '../../assets/img/BFD.jpg';

function HomeIndex() {
	const iframeRef = useRef(null);
	const [iframeSrc, setIframeSrc] = useState('http://172.16.2.100:3001/');
	const [uploading, setUploading] = useState(false);
	const [apiReady, setApiReady] = useState(false);

	// 等待 iframe 内挂载 window.VTKViewerAPI
	const waitForAPI = async (timeoutMs = 10000, intervalMs = 100) => {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const w = iframeRef.current?.contentWindow;
			try {
				if (w && w.VTKViewerAPI && typeof w.VTKViewerAPI.uploadFile === 'function') {
					return w.VTKViewerAPI;
				}
			} catch (e) {
				// 跨域会在这里抛异常；如果确定同源，这里一般不会进
				// console.log(e, 'eeeee');
			}
			await new Promise(r => setTimeout(r, intervalMs));
		}
		throw new Error('VTKViewerAPI 未就绪或跨域不可访问');
	};

	const handleIframeLoad = async () => {
		try {
			await waitForAPI();
			setApiReady(true);
			message.success('VTKViewerAPI 就绪');
		} catch (e) {
			setApiReady(false);
			message.error(e.message);
		}
	};


	// 处理文件上传 - 简化版本，直接调用上传API
	const handleFileUpload = async (event) => {
		const file = event.target.files?.[0];
		if (!file) {
			message.error('请选择文件'); return;
		}

		try {
			message.loading({ content: '正在上传文件...', key: 'upload' });
			const api = await waitForAPI(); // 等到 API
			const result = await api.uploadFile(file);
			console.log(result, 'result');

			if (result) {

				setIframeSrc(JSON.stringify(result)); // 更新 iframe
				message.success({ content: '文件上传成功', key: 'upload' });
			} else {
				message.warning({ content: '上传成功，但未返回有效URL', key: 'upload' });
			}
		} catch (e) {
			message.error({ content: `上传失败：${e.message}`, key: 'upload' });
		} finally {
			event.target.value = '';
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
				<div className='btn'>测试按钮1</div>
				<div className='btn'>测试按钮2</div>
				<div className='btn'>
					<label htmlFor="fileInput" style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						上传VTK文件
					</label>
					<input
						type="file"
						id="fileInput"
						accept=".vtk,.vtp,.vtu"
						style={{ display: 'none' }}
						onChange={handleFileUpload}
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
								<div>模型名称</div>
								<div>1</div>
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
								<div>模型名称</div>
								<div>1</div>
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
								<div>1</div>
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
				{/* <Viewer url='http://localhost:8080/' viewerId='viewer1' /> */}
				<iframe
					ref={iframeRef}
					style={{ width: 880, height: '96%' }}
					src={iframeSrc}
					onLoad={handleIframeLoad}
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