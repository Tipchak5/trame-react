import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

function fmtLwc(val, maxVal) {
	if (val === null || val === undefined) return '—';
	if (!maxVal || maxVal === 0) return val.toExponential(2);
	if (maxVal < 0.001) return val.toExponential(2);
	if (maxVal < 0.01)  return val.toFixed(5);
	if (maxVal < 0.1)   return val.toFixed(4);
	return val.toFixed(3);
}

function PieChart(props) {
	const chartRef  = useRef(null);
	const chartInst = useRef(null);
	const maxValRef = useRef(props.maxVal || 0.003);

	// 弧线用渐变（axisLine.lineStyle.color 专用格式）
	const getArcColor = () => [[
		1,
		new echarts.graphic.LinearGradient(0, 0, 1, 0, [
			{ offset: 0, color: 'rgba(22, 148, 255, 0.1)' },
			{ offset: 1, color: 'rgba(63, 250, 250, 0.8)' },
		]),
	]];

	// 指针用纯色（itemStyle.color 只接受普通颜色值）
	const POINTER_COLOR = 'rgba(63, 250, 250, 0.9)';

	useEffect(() => {
		if (!chartRef.current) return;
		chartInst.current = echarts.getInstanceByDom(chartRef.current)
			|| echarts.init(chartRef.current);
		buildFullOption(chartInst.current, maxValRef.current, props.data ?? 0);
	}, []);

	useEffect(() => {
		const newMax = props.maxVal || 0.003;
		if (!chartInst.current) { maxValRef.current = newMax; return; }
		if (newMax === maxValRef.current) return;
		maxValRef.current = newMax;
		const labelFmt = makeLabelFmt(newMax);
		chartInst.current.setOption({
			series: [
				{ min: 0, max: newMax },
				{ min: 0, max: newMax },
				{ min: 0, max: newMax, axisLabel: { formatter: labelFmt } },
				{ min: 0, max: newMax },
				{ min: 0, max: newMax },
			],
		});
	}, [props.maxVal]);

	useEffect(() => {
		if (!chartInst.current) return;
		const val = Math.min(props.data ?? 0, maxValRef.current);
		chartInst.current.setOption({
			series: [
				{}, {}, {}, {},
				{ data: [{ value: val, title: { show: false }, detail: { show: false } }] },
			],
		});
	}, [props.data]);

	const displayVal = fmtLwc(props.data, props.maxVal || 0.003);

	return (
		<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
			<div ref={chartRef} style={{ width: '100%', flex: 1 }} />
			<div style={{
				textAlign: 'center',
				paddingBottom: 10,
				fontFamily: '"Orbitron", "Rajdhani", "微软雅黑", monospace',
				fontSize: 16,
				letterSpacing: 2,
				color: '#4fe8d6',
				textShadow: '0 0 8px rgba(79,232,214,0.7)',
			}}>
				<span style={{ color: '#7ec8e3', fontSize: 11, marginRight: 6, letterSpacing: 1 }}>LWC</span>
				<span style={{ fontWeight: 'bold' }}>{displayVal}</span>
				<span style={{ color: '#7ec8e3', fontSize: 11, marginLeft: 6, letterSpacing: 1 }}>kg/m³</span>
			</div>
		</div>
	);

	function makeLabelFmt(maxVal) {
		return (v) => {
			if (maxVal < 0.001) return v.toExponential(1);
			if (maxVal < 0.01)  return v.toFixed(4);
			if (maxVal < 0.1)   return v.toFixed(3);
			return v.toFixed(2);
		};
	}

	function buildFullOption(myChart, maxVal, curRaw) {
		const arcColor   = getArcColor();
		const curVal     = Math.min(curRaw ?? 0, maxVal);
		const labelFmt   = makeLabelFmt(maxVal);
		const CENTER     = ['50%', '55%']; // 所有层统一中心点

		const option = {
			backgroundColor: 'transparent',
			series: [
				// ① 最外层刻度圈
				{
					type: 'gauge',
					center: CENTER,
					radius: '90%',
					startAngle: 220,
					endAngle: -40,
					min: 0, max: maxVal,
					axisLine: { show: true, lineStyle: { width: 3, color: arcColor } },
					axisLabel: { show: false },
					axisTick: { lineStyle: { color: 'rgba(63,250,250,0.6)', width: 1 }, length: 5 },
					splitLine: { length: 8, lineStyle: { color: 'rgba(63,250,250,0.7)', width: 3 } },
					pointer: { show: false },
					detail:  { show: false },
				},
				// ② 第二装饰圈
				{
					type: 'gauge',
					center: CENTER,
					radius: '82%',
					min: 0, max: maxVal,
					startAngle: 220,
					endAngle: -40,
					axisLine: { lineStyle: { color: arcColor, width: 2, opacity: 1 } },
					splitLine: { show: false },
					axisLabel: { show: false },
					axisTick:  { show: false },
					pointer:   { show: false },
					detail:    { show: false },
				},
				// ③ 刻度数字层（axisLine 关掉，消灭蓝色背景块）
				{
					type: 'gauge',
					center: CENTER,
					radius: '82%',
					splitNumber: 3,
					min: 0, max: maxVal,
					startAngle: 220,
					endAngle: -40,
					axisTick: { splitNumber: 4, lineStyle: { color: 'rgba(63,250,250,0.7)', width: 1 }, length: 4 },
					axisLine: { show: false },
					splitLine: { show: true, length: 7, lineStyle: { color: 'rgba(63,250,250,0.7)', width: 2 } },
					axisLabel: {
						show: true,
						distance: -6,
						formatter: labelFmt,
						color: 'rgba(241,248,248,0.85)',
						fontSize: 9,
						fontWeight: 'bold',
					},
					pointer: { show: false },
					detail:  { show: false },
				},
				// ④ 内圈装饰线
				{
					type: 'gauge',
					center: CENTER,
					radius: '65%',
					splitNumber: 5,
					min: 0, max: maxVal,
					startAngle: 220,
					endAngle: -40,
					axisLine: { lineStyle: { color: arcColor, width: 2, opacity: 1 } },
					splitLine: { show: false },
					axisLabel: { show: false },
					pointer:   { show: false },
					axisTick:  { show: false },
					detail:    { show: false },
				},
				// ⑤ 指针层
				{
					type: 'gauge',
					center: CENTER, // 与所有层一致
					radius: '74%',
					splitNumber: 5,
					min: 0, max: maxVal,
					startAngle: 220,
					endAngle: -40,
					axisLine: { show: false }, // 这层不需要弧线
					axisTick:  { show: false },
					splitLine: { show: false },
					axisLabel: { show: false },
					pointer: {
						show: true,
						length: '80%',
						width: 6,
						itemStyle: { color: POINTER_COLOR }, // ← 纯色字符串，不是渐变数组
					},
					data: [{
						value: curVal,
						title:  { show: false },
						detail: { show: false },
					}],
				},
			],
		};

		myChart.setOption(option, true);
	}
}

export default PieChart;