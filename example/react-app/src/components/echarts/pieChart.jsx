import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

function PieChart(props) {
	const chartRef = useRef(null); // 图表实例
	const colorStyle = [
		[
			1,
			new echarts.graphic.LinearGradient(0, 0, 1, 0, [
				{
					offset: 0,
					color: 'rgba(22, 148, 255, 0.1)',
				},
				{
					offset: 1,
					color: 'rgba(63, 250, 250, 0.8)',
				},
			]),
		],
	];

	useEffect(() => {
		if (chartRef.current) {
			initEchart();
		}

		// return () => {
		// 	window.removeEventListener('resize', () => {
		// 		myChart.resize();
		// 	});
		// };
	}, [props.data]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%',marginTop:'15px' }} />;
  

	/** 初始化图表 */
	function initEchart() {
		// 数据
		const option = {
			backgroundColor: '#0b3c66',
			series: [
				//最外的圆圈（外层刻度）
				{
					type: 'gauge',
					center: ['50%', '55%'],
					radius: '90%',
					startAngle: 220,
					endAngle: -40,
					min: 0,
					max: 100,
					axisLine: {
						show: true,
						lineStyle: {
							width: 3,
							color: colorStyle,
						},
					},
					axisLabel: {
						show: 0,
					},
					axisTick: {
						lineStyle: {
							color: 'rgba(63,250,250,0.6)',
							width: 1,
						},
						length: 5,
					},
					splitLine: {
						length: 8,
						lineStyle: {
							color: 'rgba(63,250,250,0.7)',
							width: 3,
						},
					},
				},
				// 外围刻度（第二层）
				{
					type: 'gauge',
					center: ['50%', '55%'],
					radius: '82%', // 1行3个
					min: 0,
					max: 100,
					startAngle: 220,
					endAngle: -40,
					axisLine: {
						// 坐标轴线
						lineStyle: {
							// 属性lineStyle控制线条样式
							color: colorStyle,
							fontSize: 20,
							width: 2,
							opacity: 1, //刻度背景宽度
						},
					},
					splitLine: {
						show: false,
					},
					axisLabel: {
						show: false,
					},
					axisTick: {
						show: false,
					},
				},
				// 外围刻度（中间有背景颜色那块，包括里面的刻度）
				{
					type: 'gauge',
					center: ['50%', '55%'],
					radius: '82%', // 1行3个
					splitNumber: 10,
					min: 0,
					max: 100,
					startAngle: 220,
					endAngle: -40,
					//分隔线样式
					axisTick: {
						lineStyle: {
							color: 'rgba(63,250,250,0.7)',
							width: 1,
						},
						length: 5,
					},
					//刻度样式
					axisLine: {
						show: true,
						lineStyle: {
							width: 100,
							color: colorStyle,
						},
					},
					//整数分隔线
					splitLine: {
						show: true,
						length: 7,
						lineStyle: {
							color: 'rgba(63, 250, 250, 0.7)',
							width: 2,
						},
					},
					//刻度数字
					axisLabel: {
						show: true,
						distance: 1,
						textStyle: {
							color: 'rgba(241, 248, 248, 0.8)',
							fontSize: '18',
							fontWeight: 'bold',
						},
					},
				},
				//从外数第三条线
				{
					type: 'gauge',
					center: ['50%', '55%'],
					radius: '65%', // 1行3个
					splitNumber: 10,
					min: 0,
					max: 100,
					startAngle: 220,
					endAngle: -40,
					axisLine: {
						// 坐标轴线
						lineStyle: {
							// 属性lineStyle控制线条样式
							color: colorStyle,
							fontSize: 20,
							width: 2,
							opacity: 1, //刻度背景宽度
						},
					},
					splitLine: {
						show: false,
					},
					axisLabel: {
						show: false,
					},
					pointer: {
						show: false,
					},
					axisTick: {
						show: false,
					},
					detail: {
						show: 0,
					},
				},
				// 内侧指针、数值显示
				{
					name: '',
					center: ['50%', '50%'],
					type: 'gauge',
					radius: '74%', // 1行3个
					splitNumber: 10,
					min: 0,
					max: 100,
					startAngle: 220,
					endAngle: -40,
					axisLine: {
						show: true,
						lineStyle: {
							width: 50,
							color: [
								[
									1,
									new echarts.graphic.LinearGradient(0, 0, 1, 0, [
										{
											offset: 0,
											color: 'rgba(0, 199, 187, 0)',
										},
										{
											offset: 1,
											color: 'rgba(0, 199, 187, 0)',
										},
									]),
								],
							],
						},
					},
					axisTick: {
						show: 0,
					},
					splitLine: {
						show: 0,
					},
					axisLabel: {
						show: 0,
					},
					pointer: {
						show: true,
						length: '102%',
						width: 8,
						itemStyle: {
							color: colorStyle,
						},
					},
					data: [
						{
							value: props.data || '56',
							name: '数据',
							title: {
								offsetCenter: ['0%', '50%'],
								fontSize: 20,
								color: '#4fe8d6',
							},
							detail: {
								offsetCenter: ['0%', '20%'],
								valueAnimation: true,
								fontSize: 30,
								color: '#4fe8d6',
							},
						},
					],
				},
			],
		};

		let myChart = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
		myChart.setOption(option);

		// setTimeout(() => {
		// 	myChart.resize(); // 在图表初始化完成后，强制调整大小
		// }, 0);
	}
}

export default PieChart;
