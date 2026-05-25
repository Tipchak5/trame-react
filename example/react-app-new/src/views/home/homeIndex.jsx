import { useEffect, useRef, useState } from 'react';
import './home.css';
import { message, Input, Modal, Button, Tabs } from 'antd';
import backgroudImg from '../../assets/img/title_bg.png';
import { BorderBox11, BorderBox7 } from '@jiaminghi/data-view-react';
import PieChart from '../../components/echarts/pieChart';
import LineChart from '../../components/echarts/lineChart';
import DataTable from '../../components/home/table';
import * as echarts from 'echarts';

// Flask 后端地址（与 iframe src 保持一致）
const BACKEND_URL = 'http://localhost:5004';

// 轮询间隔（毫秒）
const POLL_INTERVAL = 2000;

// ── FlightWaveChart：4个独立子图，示波器滚动，悬停联动LWC仪表盘 ──────────────
const WAVE_PARAMS = [
	{ key: 'altitude',    name: '高度(m)',    color: '#11D6E0', gridIdx: 0 },
	{ key: 'velocity',    name: '速度(m/s)',  color: '#f0a500', gridIdx: 1 },
	{ key: 'temperature', name: '温度(K)',    color: '#e74c3c', gridIdx: 2 },
	{ key: 'mvd',         name: 'MVD(μm)',   color: '#a855f7', gridIdx: 3 },
];

// 波形动画目标总时长（ms），数据少时自动降速，数据多时批量推进
// 每帧间隔（ms）：点少时慢一点，点多时快一点，始终每帧推1个点
const WAVE_BASE_INTERVAL   = 50;  // 默认30ms/点（约33fps）
const WAVE_MIN_INTERVAL    = 30;  // 最快16ms/点（60fps上限）
// 窗口显示点数
const WAVE_WINDOW          = 60;

function FlightWaveChart({ timeSeries, onHoverParams }) {
	const chartRef      = useRef(null);
	const chartInst     = useRef(null);
	const timerRef      = useRef(null);
	const headRef       = useRef(0);
	const userZoomRef   = useRef(false);
	// 用 ref 持有最新的 timeSeries 和回调，避免闭包捕获旧值
	const timeSeriesRef   = useRef(timeSeries);
	const onHoverParamsRef = useRef(onHoverParams);
	useEffect(() => { timeSeriesRef.current = timeSeries; },    [timeSeries]);
	useEffect(() => { onHoverParamsRef.current = onHoverParams; }, [onHoverParams]);

	// ── 初始化（只跑一次）─────────────────────────────────────────────────
	useEffect(() => {
		if (!chartRef.current) return;
		const chart = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
		chartInst.current = chart;

		chart.on('datazoom', () => { userZoomRef.current = true; });

		// 鼠标离开图表区域时清除悬停值，仪表盘恢复跟随动画
		chart.on('globalout', () => {
			const cb = onHoverParamsRef.current;
			if (cb) cb(null);
		});

		// 悬停联动：通过 ref 拿最新 timeSeries，回调全参数（彻底修复闭包捕获旧值的 bug）
		chart.on('updateAxisPointer', (evt) => {
			const ts = timeSeriesRef.current;
			const cb = onHoverParamsRef.current;
			if (!cb || !ts?.time?.length) return;
			const axisVal = evt?.axesInfo?.[0]?.value;
			if (axisVal == null) return;
			const times = ts.time;
			let idx = 0, minDiff = Infinity;
			for (let i = 0; i < times.length; i++) {
				const d = Math.abs(times[i] - axisVal);
				if (d < minDiff) { minDiff = d; idx = i; }
			}
			cb({
				altitude:    ts.altitude?.[idx]    ?? null,
				velocity:    ts.velocity?.[idx]    ?? null,
				temperature: ts.temperature?.[idx] ?? null,
				lwc:         ts.lwc?.[idx]         ?? null,
				mvd:         ts.mvd?.[idx]         ?? null,
			});
		});

		return () => { chart.dispose(); chartInst.current = null; };
	}, []);

	// ── 数据变化时重置并启动动画 ──────────────────────────────────────────
	useEffect(() => {
		const chart = chartInst.current;
		if (!chart) return;

		if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
		headRef.current = 0;
		userZoomRef.current = false;

		if (!timeSeries || !timeSeries.time?.length) {
			chart.setOption({
				backgroundColor: 'rgba(0,37,71,0)',
				graphic: [{ type: 'text', left: 'center', top: 'middle',
					style: { text: '加载仿真文件后显示波形', fill: '#555', fontSize: 13 } }],
			}, true);
			return;
		}

		const allTime = timeSeries.time;
		const total   = allTime.length;
		const buildData = (key) =>
			(timeSeries[key] || []).map((v, i) => [allTime[i], v ?? null]);
		const allData = {};
		WAVE_PARAMS.forEach(p => { allData[p.key] = buildData(p.key); });

		// 4个子图的布局（纵向均分，底部不再需要给 slider 留空间）
		const gridH  = '17%';
		const tops   = ['8%', '30%', '53%', '76%'];
		const grids  = tops.map(top => ({
			left: 58, right: 16, top, height: gridH, containLabel: false,
		}));

		const xAxes = tops.map((_, i) => ({
			type: 'value',
			gridIndex: i,
			axisLine:  { lineStyle: { color: 'rgba(2,119,175,0.5)' } },
			axisLabel: { color: '#6a8fa8', fontSize: 9, show: i === 3 },
			splitLine: { lineStyle: { color: 'rgba(6,88,142,0.35)' } },
			axisTick:  { show: false },
			// 不设 min/max，让 dataZoom 的 startValue/endValue 控制视口
			// 这样缩放没有硬边界，数据全部涌入后可以自由缩放
		}));

		const yAxes = WAVE_PARAMS.map((p, i) => ({
			type: 'value',
			gridIndex: i,
			name: p.name,
			nameTextStyle: { color: p.color, fontSize: 9, align: 'right', padding: [0, 4, 0, 0] },
			nameLocation: 'end',
			axisLabel: { color: '#6a8fa8', fontSize: 9, width: 50, overflow: 'truncate' },
			splitLine: { lineStyle: { color: 'rgba(6,88,142,0.3)' } },
			axisTick:  { show: false },
			axisLine:  { show: false },
		}));

		// 检测 MVD 是否全部是 null（没有数据）
		const mvdHasData = (timeSeries.mvd || []).some(v => v !== null && v !== undefined);

		const series = WAVE_PARAMS.map((p, i) => {
			const noData = p.key === 'mvd' && !mvdHasData;
			return {
				name: p.name,
				type: 'line',
				xAxisIndex: i,
				yAxisIndex: i,
				data: noData ? [] : [allData[p.key][0]],
				smooth: true,
				symbol: 'none',
				lineStyle: { color: noData ? '#444' : p.color, width: 1.5, type: noData ? 'dashed' : 'solid' },
				itemStyle: { color: noData ? '#444' : p.color },
				areaStyle: { color: noData ? '#444' : p.color, opacity: noData ? 0 : 0.06 },
			};
		});

		// MVD 无数据时在第4个子图上加文字提示
		const graphicExtra = !mvdHasData ? [{
			type: 'text',
			left: '50%',
			top: '85%',
			style: {
				text: '暂无 MVD 数据（需 fdj_inlet 流场文件）',
				fill: '#556',
				fontSize: 10,
				textAlign: 'center',
			},
		}] : [];

		chart.setOption({
			backgroundColor: 'rgba(0,37,71,0)',
			animation: false,
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'line', link: [{ xAxisIndex: 'all' }] },
				backgroundColor: 'rgba(1,65,122,0.92)',
				borderWidth: 0,
				textStyle: { color: '#fff', fontSize: 10 },
				formatter(params) {
					if (!params?.length) return '';
					const t = params[0]?.axisValue?.toFixed?.(4) ?? '';
					const rows = params.map(p =>
						`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>${p.seriesName}: <b>${p.value?.[1]?.toFixed?.(4) ?? '—'}</b>`
					).join('<br/>');
					return `t=${t}s<br/>${rows}`;
				},
			},
			axisPointer: { link: [{ xAxisIndex: 'all' }] },
			grid: grids,
			xAxis: xAxes,
			yAxis: yAxes,
			dataZoom: [
				{
					type: 'inside',
					xAxisIndex: [0,1,2,3],
					filterMode: 'none',
					zoomOnMouseWheel: true,      // 滚轮缩放
					moveOnMouseMove: true,        // 鼠标拖拽平移
					moveOnMouseWheel: false,
					startValue: allTime[0],
					endValue: allTime[Math.min(WAVE_WINDOW - 1, total - 1)],
				},
			],
			series,
			graphic: graphicExtra,
		}, true);

		headRef.current = 1;

		// 每帧固定推1个点，间隔根据数据量自适应：点多就快，点少就慢，最快16ms
		const waveStep     = 1;
		const waveInterval = Math.max(WAVE_MIN_INTERVAL, Math.min(WAVE_BASE_INTERVAL, Math.round(total / 30)));

		timerRef.current = setInterval(() => {
			const head = headRef.current;
			if (head >= total) {
				clearInterval(timerRef.current);
				timerRef.current = null;
				return;
			}
			const newHead = Math.min(head + waveStep, total);
			headRef.current = newHead;

			const seriesUpdate = WAVE_PARAMS.map(p => {
				if (p.key === 'mvd' && !mvdHasData) return { data: [] };
				return { data: allData[p.key].slice(0, newHead) };
			});

			// 每帧回调当前参数值，驱动仪表盘和表格同步更新
			const frameIdx = newHead - 1;
			const cb = onHoverParamsRef.current;
			if (cb) {
				cb({
					altitude:    timeSeries.altitude?.[frameIdx]    ?? null,
					velocity:    timeSeries.velocity?.[frameIdx]    ?? null,
					temperature: timeSeries.temperature?.[frameIdx] ?? null,
					lwc:         timeSeries.lwc?.[frameIdx]         ?? null,
					mvd:         timeSeries.mvd?.[frameIdx]         ?? null,
				});
			}

			// 用 dataZoom startValue/endValue 推进窗口，不动 xAxis，无硬边界
			const update = { series: seriesUpdate };
			if (!userZoomRef.current) {
				update.dataZoom = [{
					startValue: newHead > WAVE_WINDOW ? allTime[newHead - WAVE_WINDOW] : allTime[0],
					endValue:   allTime[newHead - 1],
				}];
			}

			chart.setOption(update);
		}, waveInterval);

		return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
	}, [timeSeries]);

	return <div ref={chartRef} style={{ width: '100%', height: '480px' }} />;
}

// ── FolderBrowserModal：资源管理器风格的文件夹选择器 ─────────────────────────
function FolderBrowserModal({ backendUrl, onConfirm, onCancel, fsBrowsePath, setFsBrowsePath, fsItems, setFsItems, fsError, setFsError }) {
	const [loading, setLoading] = useState(false);
	const [inputVal, setInputVal] = useState('');

	// 加载目录内容
	const loadDir = async (path) => {
		setLoading(true);
		setFsError('');
		try {
			const res = await fetch(`${backendUrl}/api/fs/list`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: path || '' }),
			});
			const json = await res.json();
			if (!json.success) {
				setFsError(json.error || '无法访问该目录');
				setFsItems([]);
			} else {
				setFsBrowsePath(json.current_path);
				setInputVal(json.current_path);
				setFsItems(json.items || []);
				setFsError('');
			}
		} catch (e) {
			setFsError('网络错误: ' + e.message);
		} finally {
			setLoading(false);
		}
	};

	// 首次打开，加载根目录（空路径让后端返回驱动器列表或根目录）
	useEffect(() => {
		if (fsItems.length === 0 && !fsBrowsePath) {
			loadDir('');
		}
	}, []);

	// 上一级
	const goUp = () => {
		if (!fsBrowsePath) return;
		// 兼容 Windows 和 Linux 路径
		const sep = fsBrowsePath.includes('\\') ? '\\' : '/';
		const parts = fsBrowsePath.split(sep).filter(Boolean);
		if (parts.length <= 1) {
			loadDir(''); // 回到根/驱动器列表
		} else {
			parts.pop();
			const parent = (fsBrowsePath.startsWith('/') ? '/' : '') + parts.join(sep);
			loadDir(parent);
		}
	};

	const ITEM_STYLE = {
		display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
		borderRadius: 4, cursor: 'pointer', userSelect: 'none',
		borderBottom: '1px solid rgba(17,214,224,0.06)',
		transition: 'background 0.15s',
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
			{/* 地址栏 */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(17,214,224,0.15)', background: 'rgba(0,20,40,0.6)' }}>
				<button
					onClick={goUp}
					disabled={loading || !fsBrowsePath}
					style={{ background: 'none', border: '1px solid rgba(17,214,224,0.3)', color: '#11D6E0', borderRadius: 4, padding: '3px 10px', cursor: fsBrowsePath ? 'pointer' : 'not-allowed', opacity: fsBrowsePath ? 1 : 0.4, fontSize: 14 }}
				>↑ 上级</button>
				<input
					value={inputVal}
					onChange={e => setInputVal(e.target.value)}
					onKeyDown={e => e.key === 'Enter' && loadDir(inputVal)}
					placeholder='输入路径后按 Enter 跳转…'
					style={{ flex: 1, background: 'rgba(0,30,60,0.8)', border: '1px solid rgba(17,214,224,0.3)', color: '#c0e8f0', borderRadius: 4, padding: '4px 10px', fontSize: 12, outline: 'none' }}
				/>
				<button
					onClick={() => loadDir(inputVal)}
					disabled={loading}
					style={{ background: 'rgba(17,214,224,0.15)', border: '1px solid rgba(17,214,224,0.4)', color: '#11D6E0', borderRadius: 4, padding: '3px 12px', cursor: 'pointer', fontSize: 12 }}
				>跳转</button>
			</div>

			{/* 文件列表 */}
			<div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,15,35,0.85)', padding: '4px 0' }}>
				{loading && (
					<div style={{ textAlign: 'center', padding: 40, color: '#7ec8e3', fontSize: 13 }}>加载中…</div>
				)}
				{!loading && fsError && (
					<div style={{ padding: '20px 16px', color: '#e74c3c', fontSize: 13 }}>❌ {fsError}</div>
				)}
				{!loading && !fsError && fsItems.length === 0 && (
					<div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>目录为空</div>
				)}
				{!loading && !fsError && fsItems.map((item) => (
					<div
						key={item.path}
						style={{ ...ITEM_STYLE }}
						onClick={() => item.is_dir ? loadDir(item.path) : null}
						onMouseEnter={e => { e.currentTarget.style.background = 'rgba(17,214,224,0.08)'; }}
						onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
					>
						<span style={{ fontSize: 16, flexShrink: 0 }}>{item.is_dir ? '📁' : '📄'}</span>
						<span style={{ flex: 1, fontSize: 13, color: item.is_dir ? '#c0e8f0' : '#7a9ab0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{item.name}
						</span>
						{item.is_dir && (
							<span style={{ fontSize: 11, color: '#11D6E0', opacity: 0.5, flexShrink: 0 }}>›</span>
						)}
						{!item.is_dir && item.ext && (
							<span style={{ fontSize: 9, color: '#7a9ab0', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>
								{item.ext.replace('.', '').toUpperCase()}
							</span>
						)}
					</div>
				))}
			</div>

			{/* 底部：当前路径 + 确认按钮 */}
			<div style={{ padding: '12px 16px', borderTop: '1px solid rgba(17,214,224,0.15)', background: 'rgba(0,20,40,0.7)', display: 'flex', alignItems: 'center', gap: 12 }}>
				<div style={{ flex: 1, fontSize: 12, color: '#7ec8e3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{fsBrowsePath ? <><span style={{ opacity: 0.6 }}>当前目录：</span>{fsBrowsePath}</> : <span style={{ opacity: 0.5 }}>请选择一个文件夹</span>}
				</div>
				<button
					onClick={onCancel}
					style={{ background: 'none', border: '1px solid rgba(17,214,224,0.25)', color: '#7ec8e3', borderRadius: 4, padding: '5px 16px', cursor: 'pointer', fontSize: 13 }}
				>取消</button>
				<button
					onClick={() => fsBrowsePath && onConfirm(fsBrowsePath)}
					disabled={!fsBrowsePath || loading}
					style={{ background: fsBrowsePath ? 'rgba(17,214,224,0.2)' : 'rgba(17,214,224,0.06)', border: '1px solid rgba(17,214,224,0.5)', color: fsBrowsePath ? '#11D6E0' : '#555', borderRadius: 4, padding: '5px 20px', cursor: fsBrowsePath ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 'bold' }}
				>
					✓ 选择此文件夹
				</button>
			</div>
		</div>
	);
}

function HomeIndex() {
	const iframeRef = useRef(null);
	const [iframeSrc, setIframeSrc] = useState(`${BACKEND_URL}/`);
	const [uploading, setUploading] = useState(false);
	const [uploadLabel, setUploadLabel] = useState('加载文件');
	const [apiReady, setApiReady] = useState(false);

	// 统一加载弹窗
	const [loadModalVisible, setLoadModalVisible] = useState(false);
	const [activeTab, setActiveTab] = useState('upload');
	const [localPath, setLocalPath] = useState('');
	// ✅ 用 loadingFilePath 替代 boolean loadingLocal，精确跟踪「哪个文件正在加载」
	// 好处：多次切换文件时不会因共享 boolean 竞态而互相污染加载状态
	const [loadingFilePath, setLoadingFilePath] = useState('');

	// 文件管理（选择文件夹后扫描结果）
	const [currentFolder, setCurrentFolder] = useState('');           // 当前文件夹路径
	const [folderModelFiles, setFolderModelFiles] = useState([]);     // 模型文件列表
	const [folderDataFiles, setFolderDataFiles] = useState([]);       // 数据源文件列表
	const [activeFilePath, setActiveFilePath] = useState('');         // 当前已加载的文件路径
	const folderInputRef = useRef(null);                              // 隐藏的文件夹选择器

	// 预加载状态 map：{ [filePath]: 'preloading' | 'ready' | 'error' }
	const [preloadStatus, setPreloadStatus] = useState({});
	const preloadStatusRef = useRef({});  // 与 preloadStatus 同步，供闭包读取
	const preloadTaskMap = useRef({});  // { [filePath]: task_id }

	// 文件夹浏览器弹窗状态
	const [fsBrowsePath, setFsBrowsePath] = useState('');  // 当前浏览的路径
	const [fsItems, setFsItems]           = useState([]);   // 当前目录内容
	const [fsError, setFsError]           = useState('');   // 错误提示

	// 动画帧控制
	const [animationFrames, setAnimationFrames] = useState([]);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const MIN_FRAME_INTERVAL = 333; // 最快 3 FPS（~333ms）
	const playTimerRef = useRef(null);
    const isPlayingRef = useRef(false); // ✅ 新增
	const clipThrottleRef = useRef(null); // ✅ 剖面拖动节流：避免每帧都重建 vtkCutter
	// ✅ 用 ref 镜像 animationFrames，避免 setInterval 闭包捕获旧值（stale closure 修复）
	const animationFramesRef = useRef([]);
	// ✅ 按需加载：总帧数 + 当前 taskId
	const [totalFrames, setTotalFrames] = useState(0);
	const totalFramesRef = useRef(0);
	const currentTaskIdRef = useRef(null);

	// 线框 & 剖面控制
	const [modelLoaded, setModelLoaded]       = useState(false);
	const [wireframe, setWireframe]           = useState(false);
	const [clipEnabled, setClipEnabled]       = useState(false);
	const [clipAxis, setClipAxis]             = useState('x');
	const [clipOffset, setClipOffset]         = useState(50); // 0~100，对应 0~1

	// 云图切换（h5 等多场量文件）
	const [availableScalars, setAvailableScalars] = useState([]); // [{name, range, type}]
	const [activeScalar, setActiveScalar]         = useState('');

	// ── 飞行参数（.out 文件实时数据）─────────────────────────────────────────
	const [outSessionId, setOutSessionId]   = useState(null);
	const [outTimeSeries, setOutTimeSeries] = useState(null);  // 完整时序
	const [flightParams, setFlightParams]   = useState({       // 当前显示值
		altitude:    null,
		velocity:    null,
		temperature: null,
		lwc:         null,
		mvd:         null,
	});
	// 悬停波形图时的全参数（驱动仪表盘），null 表示未悬停/动画中
	const [hoverParams, setHoverParams] = useState(null);
	// 各参数的全时序平均值（数据加载后计算一次）
	const [avgParams, setAvgParams] = useState({
		altitude: null, velocity: null, temperature: null, lwc: null, mvd: null,
	});
	// LWC 仪表盘量程上限 = LWC最大值 × 1.2（数据加载后计算一次）
	const [maxLwc, setMaxLwc] = useState(null);
	// 计算各参数平均值 + LWC量程（数据加载后一次性算好）
	useEffect(() => {
		if (!outTimeSeries) return;
		const calcAvg = (arr) => {
			const valid = (arr || []).filter(v => v !== null && v !== undefined);
			if (!valid.length) return null;
			return valid.reduce((s, v) => s + v, 0) / valid.length;
		};
		const calcMax = (arr) => {
			const valid = (arr || []).filter(v => v !== null && v !== undefined);
			if (!valid.length) return null;
			return Math.max(...valid);
		};
		setAvgParams({
			altitude:    calcAvg(outTimeSeries.altitude),
			velocity:    calcAvg(outTimeSeries.velocity),
			temperature: calcAvg(outTimeSeries.temperature),
			lwc:         calcAvg(outTimeSeries.lwc),
			mvd:         calcAvg(outTimeSeries.mvd),
		});
		const lwcMax = calcMax(outTimeSeries.lwc);
		if (lwcMax !== null) setMaxLwc(lwcMax * 1.2);
	}, [outTimeSeries]);
	// 动画播放时，随帧更新飞行参数
	const outTimeSeriesRef = useRef(null);
	useEffect(() => { outTimeSeriesRef.current = outTimeSeries; }, [outTimeSeries]);

	// 根据当前帧号更新飞行参数
	const updateFlightParamsForFrame = (frameIndex) => {
		const ts = outTimeSeriesRef.current;
		if (!ts) return;
		const n = ts.time?.length || 0;
		if (n === 0) return;
		// frameIndex 可能与时间步不完全一致，按比例映射
		const idx = Math.min(Math.round(frameIndex), n - 1);
		setFlightParams({
			altitude:    ts.altitude?.[idx]    ?? null,
			velocity:    ts.velocity?.[idx]    ?? null,
			temperature: ts.temperature?.[idx] ?? null,
			lwc:         ts.lwc?.[idx]         ?? null,
			mvd:         ts.mvd?.[idx]         ?? null,
		});
	};

	// 加载 .out 文件数据（目录路径，与仿真文件同目录）
	const lastOutDirRef = useRef(null);  // 记录上次加载的目录，目录不变就不重新拉
	const loadOutFiles = async (dirPath) => {
		if (lastOutDirRef.current === dirPath) {
			console.log('[out] 目录未变，跳过重新加载');
			return;
		}
		lastOutDirRef.current = dirPath;
		try {
			const res = await fetch(`${BACKEND_URL}/api/load-out-files`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dir: dirPath }),
			});
			const json = await res.json();
			if (!json.success) {
				console.warn('[out] 加载失败:', json.error);
				return;
			}
			const sid = json.session_id;
			setOutSessionId(sid);
			// 设置当前值
			if (json.current) setFlightParams(json.current);
			// 异步拉完整时序（用于波形图）
			const tsRes = await fetch(`${BACKEND_URL}/api/out-data/${sid}`);
			const tsJson = await tsRes.json();
			if (tsJson.success) {
				setOutTimeSeries(tsJson.data);
				// 初始化显示最后一帧
				const n = tsJson.data.time?.length || 0;
				if (n > 0) updateFlightParamsForFrameImmediate(tsJson.data, n - 1);
			}
		} catch (e) {
			console.warn('[out] 网络错误:', e.message);
		}
	};

	const updateFlightParamsForFrameImmediate = (ts, idx) => {
		setFlightParams({
			altitude:    ts.altitude?.[idx]    ?? null,
			velocity:    ts.velocity?.[idx]    ?? null,
			temperature: ts.temperature?.[idx] ?? null,
			lwc:         ts.lwc?.[idx]         ?? null,
			mvd:         ts.mvd?.[idx]         ?? null,
		});
	};

	// postMessage通信相关（仅用于 VTK 文件上传）
	const messageIdRef = useRef(0);
	const pendingCallbacks = useRef(new Map());

	// 轮询定时器
	const pollTimerRef = useRef(null);
	const encasInputRef = useRef(null); // 隐藏的 .encas 文件选择器

	// 停止轮询
	const stopPolling = () => {
		if (pollTimerRef.current) {
			clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	};

	// 消息监听
	useEffect(() => {
		const handleMessage = (event) => {
			if (!event.data || typeof event.data !== 'object') return;

			const { messageId, type, data, error } = event.data;

			if (type === 'vtk-ready') {
				console.log('VTK已就绪');
				setApiReady(true);
				message.success('VTK Viewer 连接成功');
				return;
			}

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

	// 组件卸载时清理
	useEffect(() => {
		return () => {
			stopPolling();
			clearTimeout(playTimerRef.current);
		};
	}, []);

	// ✅ 保持 animationFramesRef 与 animationFrames state 同步
	useEffect(() => {
		animationFramesRef.current = animationFrames;
	}, [animationFrames]);

	// ✅ 保持 totalFramesRef 与 totalFrames state 同步
	useEffect(() => {
		totalFramesRef.current = totalFrames;
	}, [totalFrames]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

	// 发送消息到VTK iframe
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

			try {
				iframeRef.current.contentWindow.postMessage({ messageId, action, data }, '*');
			} catch (e) {
				pendingCallbacks.current.delete(messageId);
				reject(new Error('发送失败: ' + e.message));
				return;
			}

			setTimeout(() => {
				if (pendingCallbacks.current.has(messageId)) {
					pendingCallbacks.current.delete(messageId);
					reject(new Error('请求超时'));
				}
			}, 40000);
		});
	};

	// 发送 VTK 文件到 iframe（postMessage 方式）
	const uploadVtkToIframe = async (file) => {
		const arrayBuffer = await file.arrayBuffer();
		return await sendToVTK('upload-file', {
			name: file.name,
			data: Array.from(new Uint8Array(arrayBuffer)),
			type: file.type || 'application/octet-stream',
		});
	};

	// ── 向 VTK iframe 发送无需回调的单向命令 ────────────────────────────────
	const postVTK = (type, payload = {}) => {
		iframeRef.current?.contentWindow?.postMessage({ type, payload }, '*');
	};

	// 云图场量切换
	const changeActiveScalar = (name) => {
		setActiveScalar(name);
		postVTK('SET_ACTIVE_SCALAR', { name });
	};

	// 线框切换（开启线框时自动关闭剖面）
	const toggleWireframe = () => {
		const next = !wireframe;
		setWireframe(next);
		postVTK('SET_WIREFRAME', { enabled: next });
	};

	// 剖面开关
	const toggleClip = () => {
		const next = !clipEnabled;
		setClipEnabled(next);
		postVTK('SET_CLIP_PLANE', { enabled: next, axis: clipAxis, offset: clipOffset / 100 });
	};

	// 剖面轴切换
	const changeClipAxis = (axis) => {
		setClipAxis(axis);
		if (clipEnabled) {
			postVTK('SET_CLIP_PLANE', { enabled: true, axis, offset: clipOffset / 100 });
		}
	};

	// 剖面滑块 —— ✅ 节流 200ms，避免拖动时每帧都重建 vtkCutter 导致卡顿
	const changeClipOffset = (val) => {
		setClipOffset(val); // UI 滑块立即响应，不等节流
		if (clipEnabled) {
			if (clipThrottleRef.current) clearTimeout(clipThrottleRef.current);
			clipThrottleRef.current = setTimeout(() => {
				postVTK('SET_CLIP_PLANE', { enabled: true, axis: clipAxis, offset: val / 100 });
			}, 200);
		}
	};

	// ── 按需加载单帧（调用后端 /api/task/<taskId>/frame/<index>）────────────
	const loadFrameOnDemand = async (taskId, frameIndex) => {
		try {
			const res = await fetch(`${BACKEND_URL}/api/task/${taskId}/frame/${frameIndex}`);
			const data = await res.json();
			if (data.success && data.url) {
				// 缓存已获取的 URL
				setAnimationFrames(prev => {
					const next = [...prev];
					next[frameIndex] = data.url;
					return next;
				});
				iframeRef.current?.contentWindow?.postMessage(
					{ type: 'LOAD_FRAME', payload: { url: data.url } },
					'*'
				);
			} else {
				message.error({ content: `帧 ${frameIndex} 加载失败: ${data.error}`, key: 'frame' });
			}
		} catch (e) {
			message.error({ content: `帧加载错误: ${e.message}`, key: 'frame' });
		}
	};

	// ── 帧控制函数 ──────────────────────────────────────────────────────────
	const goToFrame = async (index) => {
		setCurrentFrame(index);
		updateFlightParamsForFrame(index);  // 同步更新飞行参数
		const taskId = currentTaskIdRef.current;
		if (taskId) {
			// ✅ 按需模式：优先用缓存，没有则请求后端转换
			const cachedUrl = animationFramesRef.current[index];
			if (cachedUrl) {
				iframeRef.current?.contentWindow?.postMessage(
					{ type: 'LOAD_FRAME', payload: { url: cachedUrl } },
					'*'
				);
			} else {
				await loadFrameOnDemand(taskId, index);
			}
		} else {
			// 旧模式（全量预转换，frames 全部预加载完毕）
			iframeRef.current?.contentWindow?.postMessage(
				{ type: 'LOAD_FRAME', payload: { url: animationFramesRef.current[index] } },
				'*'
			);
		}
	};

	const totalCount = () => totalFramesRef.current || animationFramesRef.current.length;

	const prevFrame = () => goToFrame(Math.max(0, currentFrame - 1));
	const nextFrame = () => goToFrame(Math.min(totalCount() - 1, currentFrame + 1));

	const togglePlay = () => {
        if (isPlaying) {
            isPlayingRef.current = false; // ✅ 新增，立刻让 scheduleNext 感知到
            if (playTimerRef.current) {
                clearTimeout(playTimerRef.current);
                playTimerRef.current = null;
            }
            setIsPlaying(false);
        } else {
            if (totalCount() === 0) return;
            setIsPlaying(true);

            const scheduleNext = (frameIndex) => {
                const start = Date.now();
                const taskId = currentTaskIdRef.current;
                const frames = animationFramesRef.current;
                const total = totalCount();
                if (!total) return;

                const doLoad = async () => {
                    if (taskId) {
                        const cachedUrl = frames[frameIndex];
                        if (cachedUrl) {
                            iframeRef.current?.contentWindow?.postMessage(
                                { type: 'LOAD_FRAME', payload: { url: cachedUrl } }, '*'
                            );
                        } else {
                            await loadFrameOnDemand(taskId, frameIndex);
                        }
                    } else {
                        if (frames[frameIndex]) {
                            iframeRef.current?.contentWindow?.postMessage(
                                { type: 'LOAD_FRAME', payload: { url: frames[frameIndex] } }, '*'
                            );
                        }
                    }
                    setCurrentFrame(frameIndex);

                    if (!isPlayingRef.current) return; // ✅ 新增：await 结束后再检查一次，已暂停就不继续

                    // 计算剩余等待时间，保证最低间隔
                    const elapsed = Date.now() - start;
                    const delay = Math.max(MIN_FRAME_INTERVAL - elapsed, 0);
                    playTimerRef.current = setTimeout(() => {
                        scheduleNext((frameIndex + 1) % totalCount());
                    }, delay);
                };

                doLoad();
            };

            setCurrentFrame(prev => {
                scheduleNext((prev + 1) % totalCount());
                return prev;
            });
        }
    };

	const handleIframeLoad = () => {
		console.log('iframe已加载，等待VTK就绪...');
	};

	// ── 轮询任务状态（ZIP 异步转换 + 本地路径加载专用）──────────────────────
	const pollTaskStatus = (task_id, filename) => {
		stopPolling(); // 确保没有重复轮询

		pollTimerRef.current = setInterval(async () => {
			try {
				const res = await fetch(`${BACKEND_URL}/api/task/${task_id}`);
				const data = await res.json();

				if (!data.success) {
					stopPolling();
					setUploading(false);
					setLoadingFilePath('');
					setUploadLabel('加载文件');
					message.error({ content: `任务查询失败: ${data.error}`, key: 'upload' });
					return;
				}

				const { status, progress, result, error } = data;

				// 更新按钮文字显示进度
				if (status === 'converting') {
					setUploadLabel(`转换中 ${progress}%`);
					message.loading({
						content: `后台转换中... ${progress}%`,
						key: 'upload',
						duration: 0,
					});
				} else if (status === 'extracting') {
					setUploadLabel('解压中...');
					message.loading({ content: '正在解压 ZIP 文件...', key: 'upload', duration: 0 });
				} else if (status === 'searching') {
					setUploadLabel('查找文件中...');
					message.loading({ content: '正在查找 EnSight 文件...', key: 'upload', duration: 0 });
				} else if (status === 'queued') {
					setUploadLabel('排队中...');
				} else if (status === 'ready_to_stream') {
					// ✅ 按需加载模式：后端扫描完帧数，立即返回，前端按需拉帧
					stopPolling();
					setUploading(false);
					setLoadingFilePath('');
					setUploadLabel('加载文件');

					const total = result?.total_frames || 0;
					if (total > 0) {
						currentTaskIdRef.current = task_id;
						setTotalFrames(total);
						setCurrentFrame(0);
						setModelLoaded(true);
						// 预分配帧缓存数组（null 占位），按需填入 URL
						setAnimationFrames(new Array(total).fill(null));
						// 立刻加载第 0 帧
						loadFrameOnDemand(task_id, 0);
						message.success({
							content: result?.message || `共 ${total} 帧，按需加载`,
							key: 'upload',
						});
					}
				} else if (status === 'done') {
					stopPolling();
					setUploading(false);
					setLoadingFilePath('');
					setUploadLabel('加载文件');

					if (result?.frames?.length) {
						const isAnimation = result.frames.length > 1;
						setCurrentFrame(0);
						setModelLoaded(true);
						iframeRef.current?.contentWindow?.postMessage(
							{ type: 'LOAD_FRAME', payload: { url: result.frames[0] } },
							'*'
						);
						if (isAnimation) {
							// encas 多帧动画：显示帧控制按钮
							setAnimationFrames(result.frames);
							message.success({ content: `转换成功！共 ${result.frames.length} 帧`, key: 'upload' });
							console.log(`动画加载完成: ${result.frames.length} 帧`);
						} else {
							// h5 单帧：不显示帧控制，但显示线框/剖面/云图切换按钮
							setAnimationFrames([]);
							// 存储所有可用场量，供用户切换云图
							if (result.scalars?.length) {
								setAvailableScalars(result.scalars);
								setActiveScalar(result.scalars[0].name);
							}
							message.success({ content: result?.message || '文件加载成功', key: 'upload' });
						}
					} else {
						message.success({ content: result?.message || '转换完成', key: 'upload' });
					}
				} else if (status === 'error') {
					stopPolling();
					setUploading(false);
					setLoadingFilePath('');
					setUploadLabel('加载文件');
					message.error({ content: `转换失败: ${error}`, key: 'upload' });
				}
			} catch (e) {
				// 网络抖动时不立刻停止，等下次轮询
				console.warn('轮询失败，将重试:', e.message);
			}
		}, POLL_INTERVAL);
	};

	// ── 后台静默预加载其他模型文件 ────────────────────────────────────────────
	const preloadOtherFiles = (modelFiles, skipPath) => {
		const others = modelFiles.filter(f => f.path !== skipPath);
		if (!others.length) return;

		others.forEach(async (f) => {
			preloadStatusRef.current = { ...preloadStatusRef.current, [f.path]: 'preloading' };
			setPreloadStatus(prev => ({ ...prev, [f.path]: 'preloading' }));
			try {
				const res = await fetch(`${BACKEND_URL}/api/load-local`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path: f.path }),
				});
				const json = await res.json();
				if (json.success && json.async && json.task_id) {
					preloadTaskMap.current[f.path] = json.task_id;
					// 轮询直到完成
					const pollPreload = setInterval(async () => {
						try {
							const r = await fetch(`${BACKEND_URL}/api/task/${json.task_id}`);
							const d = await r.json();
							if (d.status === 'done' || d.status === 'ready_to_stream') {
								clearInterval(pollPreload);
								preloadStatusRef.current = { ...preloadStatusRef.current, [f.path]: 'ready' };
								setPreloadStatus(prev => ({ ...prev, [f.path]: 'ready' }));
							} else if (d.status === 'error') {
								clearInterval(pollPreload);
								preloadStatusRef.current = { ...preloadStatusRef.current, [f.path]: 'error' };
								setPreloadStatus(prev => ({ ...prev, [f.path]: 'error' }));
							}
						} catch { clearInterval(pollPreload); }
					}, 2000);
				} else {
					preloadStatusRef.current = { ...preloadStatusRef.current, [f.path]: 'error' };
					setPreloadStatus(prev => ({ ...prev, [f.path]: 'error' }));
				}
			} catch {
				preloadStatusRef.current = { ...preloadStatusRef.current, [f.path]: 'error' };
				setPreloadStatus(prev => ({ ...prev, [f.path]: 'error' }));
			}
		});
	};

	// ── 扫描文件夹（发送完整路径到后端，获取文件列表）──────────────────────────
	const handleBrowseFolder = async (folderPath) => {
		const path = (folderPath || '').trim();
		if (!path) { message.error('请选择文件夹'); return; }

		try {
			// ✅ 不用 loadingFilePath，用 message 提示扫描进度即可
			message.loading({ content: '正在扫描文件夹...', key: 'browse', duration: 0 });

			const res = await fetch(`${BACKEND_URL}/api/browse-folder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path }),
			});
			const json = await res.json();
			if (!json.success) {
				message.error({ content: `扫描失败: ${json.error}`, key: 'browse' });
				return;
			}

			message.destroy('browse');
			setCurrentFolder(json.folder);
			setFolderModelFiles(json.model_files || []);
			setFolderDataFiles(json.data_files  || []);
			setLoadModalVisible(false);

			// 自动加载默认文件（default.new.encas 或第一个模型文件）
			if (json.auto_load) {
				await loadFileFromFolder(json.auto_load, json.folder);
				// 其余模型文件后台静默预加载（不影响当前加载）
				preloadOtherFiles(json.model_files || [], json.auto_load);
			} else {
				message.warning('文件夹中未找到可加载的模型文件');
			}
		} catch (e) {
			message.error({ content: `网络错误: ${e.message}`, key: 'browse' });
		}
		// ✅ 去掉了 finally { setLoadingLocal(false) }
		// 原来这个 finally 会在 loadFileFromFolder 返回（但 poll 还没完成）后立刻清掉
		// 加载状态，导致"已加载"在转换完成前就提前显示，或竞态清掉后续加载的 loading 状态
	};

	// ── 从文件管理面板点击文件切换加载 ──────────────────────────────────────────
	const loadFileFromFolder = async (filePath, dirPath) => {
		const dir = dirPath || currentFolder;

		// 清除旧模型状态
		setAnimationFrames([]);
		setCurrentFrame(0);
		setIsPlaying(false);
		clearInterval(playTimerRef.current);
		playTimerRef.current = null;
		setModelLoaded(false);
		setWireframe(false);
		setClipEnabled(false);
		setAvailableScalars([]);
		setActiveScalar('');
		setTotalFrames(0);
		currentTaskIdRef.current = null;
		postVTK('SET_WIREFRAME',  { enabled: false });
		postVTK('SET_CLIP_PLANE', { enabled: false, axis: 'x', offset: 0.5 });
		postVTK('CLEAR_MODEL', {});

		setActiveFilePath(filePath);
		// ✅ 立刻标记「这个文件正在加载」，UI 显示"加载中…"
		setLoadingFilePath(filePath);

		try {
			message.loading({ content: `正在加载: ${filePath.split(/[\\/]/).pop()}`, key: 'upload', duration: 0 });

			// 预加载已完成：直接用缓存的 task_id，无需重新上传转换
			const cachedTaskId = preloadTaskMap.current[filePath];
			const isPreloaded  = preloadStatusRef.current[filePath] === 'ready' && cachedTaskId;

			if (isPreloaded) {
				message.loading({ content: '预加载完成，切换中...', key: 'upload', duration: 0 });
				if (dir) loadOutFiles(dir);
				pollTaskStatus(cachedTaskId, filePath.split(/[\\/]/).pop());
				// ✅ 不 return 前清 loading——pollTaskStatus 内部会调用 setLoadingFilePath('')
				return;
			}

			const response = await fetch(`${BACKEND_URL}/api/load-local`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: filePath }),
			});

			if (!response.ok) {
				const errJson = await response.json().catch(() => ({}));
				message.error({ content: `加载失败: ${errJson.error || response.statusText}`, key: 'upload' });
				setLoadingFilePath('');
				return;
			}

			const result = await response.json();
			if (!result.success) {
				message.error({ content: `加载失败: ${result.error}`, key: 'upload' });
				setLoadingFilePath('');
				return;
			}

			if (result.async && result.task_id) {
				message.loading({ content: '文件已接收，后台转换中...', key: 'upload', duration: 0 });
				if (dir) loadOutFiles(dir);
				pollTaskStatus(result.task_id, result.message);
			}
		} catch (e) {
			message.error({ content: `网络错误：${e.message}`, key: 'upload' });
			setLoadingFilePath('');
		}
	};

	// ── 本地路径加载 ─────────────────────────────────────────────────────────
	const handleLocalPathLoad = async () => {
		if (!localPath.trim()) {
			message.error('请输入本地路径');
			return;
		}

		// 清除旧模型的所有UI状态
		setAnimationFrames([]);
		setCurrentFrame(0);
		setIsPlaying(false);
		clearInterval(playTimerRef.current);
		playTimerRef.current = null;
		setModelLoaded(false);
		setWireframe(false);
		setClipEnabled(false);
		setAvailableScalars([]);
		setActiveScalar('');
		setTotalFrames(0);
		currentTaskIdRef.current = null;
        // 重置线框和剖面（防止新模型继承旧状态）
        postVTK('SET_WIREFRAME', { enabled: false });
        postVTK('SET_CLIP_PLANE', { enabled: false, axis: 'x', offset: 0.5 });
        // ✅ 新增这一行：立刻让 iframe 清空当前模型
        postVTK('CLEAR_MODEL', {});

		try {
			setLoadingLocal(true);
			message.loading({
				content: '正在从本地路径加载...',
				key: 'upload',
				duration: 0,
			});

			const response = await fetch(`${BACKEND_URL}/api/load-local`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ path: localPath }),
			});

			if (!response.ok) {
				const errJson = await response.json().catch(() => ({}));
				message.error({
					content: `加载失败: ${errJson.error || response.statusText}`,
					key: 'upload',
				});
				setLoadingLocal(false);
				return;
			}

			const result = await response.json();

			if (!result.success) {
				message.error({ content: `加载失败: ${result.error}`, key: 'upload' });
				setLoadingLocal(false);
				return;
			}

			// 后端返回 async: true，说明转换在后台跑，开始轮询
			if (result.async && result.task_id) {
				message.loading({
					content: '文件已接收，后台转换中...',
					key: 'upload',
					duration: 0,
				});
				// 同步加载同目录的 .out 飞行参数文件
				const dirPath = localPath.trim();
				loadOutFiles(dirPath);
				setLoadModalVisible(false);
				setLocalPath('');
				pollTaskStatus(result.task_id, result.message);
			}
		} catch (e) {
			message.error({ content: `网络错误：${e.message}`, key: 'upload' });
			setLoadingLocal(false);
		}
	};

	// ── 核心：文件上传分流逻辑 ─────────────────────────────────────────────
	const handleFileUpload = async (event) => {
		const file = event.target.files?.[0];
		if (!file) {
			message.error('请选择文件');
			return;
		}

		// 清除旧模型的所有UI状态
		setAnimationFrames([]);
		setCurrentFrame(0);
		setIsPlaying(false);
		clearInterval(playTimerRef.current);
		playTimerRef.current = null;
		setModelLoaded(false);
		setWireframe(false);
		setClipEnabled(false);
		setAvailableScalars([]);
		setActiveScalar('');
		setTotalFrames(0);
		currentTaskIdRef.current = null;
        // 重置线框和剖面（防止新模型继承旧状态）
        postVTK('SET_WIREFRAME', { enabled: false });
        postVTK('SET_CLIP_PLANE', { enabled: false, axis: 'x', offset: 0.5 });
        postVTK('CLEAR_MODEL', {}); // ✅ 新增：立刻清空 iframe 里的旧模型

		const ext = file.name.split('.').pop().toLowerCase();
		const isZip = ext === 'zip';

		// ── ZIP 文件：发送到 Flask 后端，后端异步转换 ────────────────────────
		if (isZip) {
			try {
				setUploading(true);
				setUploadLabel('上传中...');
				message.loading({
					content: '正在上传 ZIP 文件...',
					key: 'upload',
					duration: 0,
				});

				const formData = new FormData();
				formData.append('file', file);

				// 这个 fetch 只负责上传文件，后端立即返回 task_id（不等转换）
				const response = await fetch(`${BACKEND_URL}/api/upload`, {
					method: 'POST',
					body: formData,
				});

				if (!response.ok) {
					const errJson = await response.json().catch(() => ({}));
					// 413 = 文件超过后端限制（MAX_CONTENT_LENGTH）
					const errMsg =
						response.status === 413
							? errJson.error || '文件过大，超过服务器限制（最大 500 MB）'
							: errJson.error || response.statusText;
					message.error({ content: `上传失败: ${errMsg}`, key: 'upload' });
					setUploading(false);
					setUploadLabel('加载文件');
					return;
				}

				const result = await response.json();

				if (!result.success) {
					message.error({ content: `上传失败: ${result.error}`, key: 'upload' });
					setUploading(false);
					setUploadLabel('加载文件');
					return;
				}

				// 后端返回 async: true，说明转换在后台跑，开始轮询
				if (result.async && result.task_id) {
					message.loading({
						content: '文件已接收，后台转换中...',
						key: 'upload',
						duration: 0,
					});
					setUploadLabel('转换中...');
					pollTaskStatus(result.task_id, result.fileName);
				} else {
					// 同步返回（理论上 ZIP 不会走这里）
					message.success({ content: result.message || '上传成功', key: 'upload' });
					setUploading(false);
					setUploadLabel('加载文件');
				}
			} catch (e) {
				message.error({ content: `网络错误：${e.message}`, key: 'upload' });
				setUploading(false);
				setUploadLabel('加载文件');
			} finally {
				event.target.value = '';
			}
			return;
		}

		// ── VTK / VTP / VTU 文件：postMessage 发给 VTK iframe ─────────────
		if (!apiReady) {
			message.error('VTK未就绪，请等待连接');
			event.target.value = '';
			return;
		}

		try {
			setUploading(true);
			setUploadLabel('上传中...');
			message.loading({ content: '正在上传文件...', key: 'upload' });

			const result = await uploadVtkToIframe(file);

			if (result && result.success) {
				message.success({ content: '文件上传成功', key: 'upload' });
				setModelLoaded(true);
				if (result.simulationData?.success) {
					console.log('仿真数据:', result.simulationData.data);
				}
			} else {
				message.error({
					content: `上传失败: ${result?.error || '未知错误'}`,
					key: 'upload',
				});
			}
		} catch (e) {
			message.error({ content: `上传失败：${e.message}`, key: 'upload' });
		} finally {
			setUploading(false);
			setUploadLabel('加载文件');
			event.target.value = '';
		}
	};

	return (
		<div className='HomeView'>
			<div className='title'>
				<img className='title_bg' src={backgroudImg} alt='' />
				{/* <span className='title_txt'>航空发动机结冰风洞可视化平台</span> */}
				<span className='title_txt'>可视化平台</span>
			</div>

			{/* 按钮操作 */}
			<div className='btnArr'>
				{/* 唯一入口：选择文件夹 */}
				<div
					className='btn'
					onClick={() => !uploading && !loadingFilePath && setLoadModalVisible(true)}
					style={{ cursor: uploading || loadingFilePath ? 'not-allowed' : 'pointer', opacity: uploading || loadingFilePath ? 0.5 : 1 }}
				>
					{uploadLabel === '加载文件' ? '选择文件夹' : uploadLabel}
				</div>

				{/* 帧控制按钮（仅在加载多帧动画后显示，h5单帧不显示） */}
				{(totalFrames > 1 || animationFrames.filter(Boolean).length > 1) && (
					<>
						<div
							className='btn'
							onClick={prevFrame}
							style={{ cursor: currentFrame === 0 ? 'not-allowed' : 'pointer', opacity: currentFrame === 0 ? 0.5 : 1 }}
						>
							上一帧
						</div>
						<span style={{ color: '#11D6E0', lineHeight: '40px', padding: '0 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
							{currentFrame + 1} / {totalFrames || animationFrames.filter(Boolean).length}
						</span>
						<div
							className='btn'
							onClick={nextFrame}
							style={{ cursor: currentFrame === (totalFrames || animationFrames.filter(Boolean).length) - 1 ? 'not-allowed' : 'pointer', opacity: currentFrame === (totalFrames || animationFrames.filter(Boolean).length) - 1 ? 0.5 : 1 }}
						>
							下一帧
						</div>
						<div className='btn' onClick={togglePlay} style={{ cursor: 'pointer' }}>
							{isPlaying ? '暂停' : '播放'}
						</div>
					</>
				)}

				{/* 线框 & 剖面控制（模型加载后显示） */}
				{modelLoaded && (
					<>
						{/* 分隔线 */}
						<span style={{ color: '#11D6E0', opacity: 0.3, lineHeight: '40px', padding: '0 4px' }}>|</span>

						{/* 线框按钮 */}
						<div
							className='btn'
							onClick={toggleWireframe}
							style={{
								cursor: 'pointer',
								background: wireframe ? 'rgba(17,214,224,0.25)' : undefined,
								border: wireframe ? '1px solid #11D6E0' : undefined,
							}}
						>
							{wireframe ? '实体' : '线框'}
						</div>

						{/* 剖面开关 */}
						<div
							className='btn'
							onClick={toggleClip}
							style={{
								cursor: 'pointer',
								background: clipEnabled ? 'rgba(17,214,224,0.25)' : undefined,
								border: clipEnabled ? '1px solid #11D6E0' : undefined,
							}}
						>
							{clipEnabled ? '关闭剖面' : '剖面'}
						</div>

						{/* 剖面轴 + 位置（仅剖面开启时显示） */}
						{clipEnabled && (
							<>
								{/* 轴选择 */}
								{['x', 'y', 'z'].map(ax => (
									<div
										key={ax}
										className='btn'
										onClick={() => changeClipAxis(ax)}
										style={{
											cursor: 'pointer',
											padding: '0 10px',
											background: clipAxis === ax ? 'rgba(17,214,224,0.35)' : undefined,
											border: clipAxis === ax ? '1px solid #11D6E0' : undefined,
										}}
									>
										{ax.toUpperCase()}轴
									</div>
								))}

								{/* 位置滑块 */}
								<div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px' }}>
									<span style={{ color: '#11D6E0', fontSize: 12, whiteSpace: 'nowrap' }}>位置</span>
									<input
										type='range'
										min={0}
										max={100}
										value={clipOffset}
										onChange={e => changeClipOffset(Number(e.target.value))}
										style={{
											width: 100,
											accentColor: '#11D6E0',
											cursor: 'pointer',
										}}
									/>
									<span style={{ color: '#11D6E0', fontSize: 12, minWidth: 28 }}>{clipOffset}%</span>
								</div>
							</>
						)}

						{/* 云图场量切换（h5 多场量时显示） */}
						{availableScalars.length > 1 && (
							<>
								<span style={{ color: '#11D6E0', opacity: 0.3, lineHeight: '40px', padding: '0 4px' }}>|</span>
								<div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px' }}>
									<span style={{ color: '#11D6E0', fontSize: 12, whiteSpace: 'nowrap' }}>云图</span>
									<select
										value={activeScalar}
										onChange={e => changeActiveScalar(e.target.value)}
										style={{
											background: 'rgba(0,20,40,0.85)',
											color: '#11D6E0',
											border: '1px solid #11D6E0',
											borderRadius: 4,
											padding: '2px 6px',
											fontSize: 12,
											cursor: 'pointer',
											maxWidth: 160,
										}}
									>
										{availableScalars.map(s => (
											<option key={s.name} value={s.name} style={{ background: '#001428' }}>
												{s.name}
											</option>
										))}
									</select>
								</div>
							</>
						)}
					</>
				)}
			</div>

			{/* 选择文件夹弹窗 —— 内嵌文件系统浏览器 */}
			<Modal
				title={<span style={{ color: '#11D6E0', fontSize: 15, letterSpacing: 1 }}>选择文件夹</span>}
				open={loadModalVisible}
				footer={null}
				onCancel={() => { setLoadModalVisible(false); setFsBrowsePath(''); setFsItems([]); setFsError(''); }}
				width={600}
				bodyStyle={{ padding: 0 }}
				styles={{
					content: {
						background: 'rgba(0, 18, 40, 0.97)',
						border: '1px solid rgba(17, 214, 224, 0.35)',
						borderRadius: 8,
						boxShadow: '0 0 32px rgba(17, 214, 224, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
						padding: 0,
					},
					header: {
						background: 'transparent',
						borderBottom: '1px solid rgba(17, 214, 224, 0.2)',
						padding: '14px 20px',
					},
					body: { padding: 0 },
				}}
				closeIcon={<span style={{ color: '#7ec8e3', fontSize: 16 }}>✕</span>}
			>
				<FolderBrowserModal
					backendUrl={BACKEND_URL}
					onConfirm={(path) => {
						setLoadModalVisible(false);
						setFsBrowsePath('');
						setFsItems([]);
						setFsError('');
						handleBrowseFolder(path);
					}}
					onCancel={() => { setLoadModalVisible(false); setFsBrowsePath(''); setFsItems([]); setFsError(''); }}
					fsBrowsePath={fsBrowsePath}
					setFsBrowsePath={setFsBrowsePath}
					fsItems={fsItems}
					setFsItems={setFsItems}
					fsError={fsError}
					setFsError={setFsError}
				/>
			</Modal>

			{/* 左侧数据 */}
			<div className='leftBox'>
				<BorderBox11
					className='leftTop'
					title='文件管理'
					style={{ width: 480, height: 510 }}
					color={['#11D6E0', '#037cb1']}
				>
					{currentFolder ? (
						<div style={{ padding: '8px 12px', height: '100%', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
							{/* 当前文件夹路径 */}
							<div style={{ fontSize: 10, color: '#7ec8e3', opacity: 0.8, wordBreak: 'break-all', marginBottom: 4, borderBottom: '1px solid rgba(17,214,224,0.15)', paddingBottom: 6 }}>
								📁 {currentFolder}
							</div>

							{/* 模型文件 */}
							{folderModelFiles.length > 0 && (
								<>
									<div style={{ fontSize: 10, color: '#11D6E0', letterSpacing: 1, opacity: 0.7, marginBottom: 2 }}>模型文件</div>
									{folderModelFiles.map((f) => {
										const isActive = f.path === activeFilePath;
										// ✅ isLoading 现在精确跟踪「这个文件是否正在加载」，不受其他文件的加载状态影响
										const isLoading = f.path === loadingFilePath;
										const extColor = f.ext === '.encas' || f.ext === '.case' ? '#4fe8d6'
											: f.ext.includes('h5') ? '#f0a500'
											: '#a0d4e8';
										return (
											<div
												key={f.path}
												onClick={() => !loadingFilePath && loadFileFromFolder(f.path)}
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 8,
													padding: '6px 10px',
													borderRadius: 4,
													cursor: loadingFilePath ? 'not-allowed' : 'pointer',
													background: isActive ? 'rgba(17,214,224,0.12)' : 'rgba(255,255,255,0.03)',
													border: isActive ? '1px solid rgba(17,214,224,0.4)' : '1px solid rgba(17,214,224,0.1)',
													transition: 'all 0.2s',
												}}
												onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(17,214,224,0.06)'; }}
												onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
											>
												<span style={{ fontSize: 9, fontWeight: 'bold', color: extColor, background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 2, flexShrink: 0 }}>
													{f.ext.replace('.', '').toUpperCase()}
												</span>
												<span style={{ fontSize: 11, color: isActive ? '#fff' : '#c0dce8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{f.name}
												</span>
												{isLoading && <span style={{ fontSize: 10, color: '#11D6E0', flexShrink: 0 }}>加载中…</span>}
												{isActive && !isLoading && <span style={{ fontSize: 10, color: '#4fe8d6', flexShrink: 0 }}>✓ 已加载</span>}
												{!isActive && !isLoading && preloadStatus[f.path] === 'preloading' && (
													<span style={{ fontSize: 9, color: '#a0c4d8', flexShrink: 0, opacity: 0.7 }}>预热中…</span>
												)}
											</div>
										);
									})}
								</>
							)}

							{/* 数据源文件 */}
							{folderDataFiles.length > 0 && (
								<>
									<div style={{ fontSize: 10, color: '#f0a500', letterSpacing: 1, opacity: 0.7, marginBottom: 2, marginTop: 4 }}>数据源文件（波形/仪表盘）</div>
									{folderDataFiles.map((f) => (
										<div
											key={f.path}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '5px 10px',
												borderRadius: 4,
												background: 'rgba(255,255,255,0.02)',
												border: '1px solid rgba(240,165,0,0.12)',
											}}
										>
											<span style={{ fontSize: 9, fontWeight: 'bold', color: '#f0a500', background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 2, flexShrink: 0 }}>
												{f.ext.replace('.', '').toUpperCase()}
											</span>
											<span style={{ fontSize: 11, color: '#b8a060', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
												{f.name}
											</span>
										</div>
									))}
								</>
							)}

							{folderModelFiles.length === 0 && folderDataFiles.length === 0 && (
								<div style={{ color: '#555', fontSize: 12, marginTop: 20, textAlign: 'center' }}>该文件夹中未找到支持的文件</div>
							)}

							{/* 重新选择文件夹 */}
							<div
								onClick={() => setLoadModalVisible(true)}
								style={{ marginTop: 'auto', paddingTop: 8, textAlign: 'center', fontSize: 11, color: '#11D6E0', opacity: 0.6, cursor: 'pointer', borderTop: '1px solid rgba(17,214,224,0.1)' }}
							>
								重新选择文件夹
							</div>
						</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
							<div style={{ fontSize: 32, opacity: 0.3 }}>📂</div>
							<div style={{ color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
								点击顶部 <b style={{ color: '#11D6E0', opacity: 0.8 }}>选择文件夹</b> 按钮<br />
								加载后此处显示文件列表
							</div>
						</div>
					)}
				</BorderBox11>

				<BorderBox11
					className='leftBottom'
					title='飞行参数'
					style={{ width: 480, height: 340 }}
					color={['#11D6E0', '#037cb1']}
				>
					<div style={{ padding: '12px 16px', height: '100%', overflowY: 'auto' }}>
						{outSessionId ? (
							<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
								<thead>
									<tr style={{ color: '#11D6E0', borderBottom: '1px solid rgba(17,214,224,0.3)' }}>
										<th style={{ textAlign: 'left',  padding: '6px 6px', fontWeight: 500 }}>参数</th>
										<th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 500 }}>最新值</th>
										<th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 500, color: '#7ec8e3' }}>平均值</th>
										<th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 500 }}>单位</th>
									</tr>
								</thead>
								<tbody>
									{[
										{ key: 'altitude',    label: '飞行高度',      unit: 'm',      digits: 1 },
										{ key: 'velocity',    label: '飞行速度',      unit: 'm/s',    digits: 3 },
										{ key: 'temperature', label: '发动机入口温度', unit: 'K',     digits: 3 },
										{ key: 'lwc',         label: '液态水含量 LWC', unit: 'kg/m³', digits: 6 },
										{ key: 'mvd',         label: '中值粒径 MVD',  unit: 'μm',    digits: 3 },
									].map(({ key, label, unit, digits }) => {
										const latest = flightParams[key];
										const avg    = avgParams[key];
										return (
											<tr key={key} style={{ borderBottom: '1px solid rgba(17,214,224,0.1)' }}>
												<td style={{ padding: '7px 6px', color: '#a0d4e8' }}>{label}</td>
												<td style={{ padding: '7px 6px', textAlign: 'right', color: '#fff', fontFamily: 'monospace', fontSize: 13 }}>
													{latest !== null && latest !== undefined
														? Number(latest).toFixed(digits)
														: <span style={{ color: '#555' }}>—</span>}
												</td>
												<td style={{ padding: '7px 6px', textAlign: 'right', color: '#7ec8e3', fontFamily: 'monospace', fontSize: 13 }}>
													{avg !== null && avg !== undefined
														? Number(avg).toFixed(digits)
														: <span style={{ color: '#555' }}>—</span>}
												</td>
												<td style={{ padding: '7px 6px', textAlign: 'right', color: '#11D6E0', opacity: 0.7 }}>{unit}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						) : (
							<div style={{ color: '#555', fontSize: 13, marginTop: 20, textAlign: 'center' }}>
								加载仿真文件后自动读取飞行参数
								<br />
								<span style={{ fontSize: 11, color: '#444', marginTop: 8, display: 'block' }}>
									需要同目录下的 absolute-p-rfile.out、tem-rfile.out、<br />sudu-rfile.out、yetaishui-rfile.out
								</span>
							</div>
						)}
					</div>
				</BorderBox11>
			</div>

			{/* 中间模型 */}
			<div className='centerBox'>
				<iframe
					ref={iframeRef}
					style={{ width: 880, height: 800 }}
					src={iframeSrc}
					onLoad={handleIframeLoad}
					title='VTK Viewer'
				></iframe>
			</div>

			{/* 右侧数据 */}
			<div className='rightBox'>
				<BorderBox11
					className='rightTop'
					title='液态水含量 (LWC)'
					style={{ width: 480, height: 300 }}
					color={['#11D6E0', '#037cb1']}
				>
					<PieChart
						data={hoverParams?.lwc ?? flightParams.lwc ?? 0}
						maxVal={maxLwc || 0.003}
					/>
				</BorderBox11>

				<BorderBox11
					className='rightBottom'
					title='飞行参数波形图'
					style={{ width: 480, height: 550 }}
					color={['#11D6E0', '#037cb1']}
				>
					<FlightWaveChart timeSeries={outTimeSeries} onHoverParams={setHoverParams} />
				</BorderBox11>
			</div>
		</div>
	);
}

export default HomeIndex;