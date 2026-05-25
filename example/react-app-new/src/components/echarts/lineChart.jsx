import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

function LineChart(props) {
	const chartRef = useRef(null); // 图表实例
	const threshold = 180; // 设置阈值

	const time = [
		'2023-01',
		'2023-02',
		'2023-03',
		'2023-04',
		'2023-05',
		'2023-06',
		'2023-07',
		'2023-08',
		'2023-09',
		'2023-10',
		'2023-11',
		'2023-12',
	];

	const data = [{ name: '', data: [150, 160, 210, 100, 350, 110, 300, 200, 180, 170, 330, 260] }];

	useEffect(() => {
		if (chartRef.current) {
			initEchart();
		}
		return () => {
			window.removeEventListener('resize', () => {
				myChart.resize();
			});
		};
	}, [props.data]);

	return <div ref={chartRef} style={{ width: '100%', height: '100%', marginTop: '24px' }} />;

	/** 初始化图表 */
	function initEchart() {
		// 数据
		const option = {
			backgroundColor: 'rgba(0, 55, 107)',
			visualMap: {
				show: false,
				seriesIndex: 0,
				pieces: [
					{
						gt: 0,
						lte: threshold, //这儿设置基线上下颜色区分 基线下面为绿色
						color: '#00ff00',
					},
					{
						gt: threshold,
						//中间部分颜色显示
						color: '#ff0000',
					},
				],
			},
			animation: false,
			tooltip: {
				trigger: 'axis',
				borderWidth: 0,
				backgroundColor: 'rgba(1, 65, 122,0.5)',
				textStyle: {
					// 添加 textStyle 属性
					color: '#fff', // 设置字体颜色
				},
				formatter: function (params) {
					const time = params[0].name || '';
					const tem = params[0] || '';
					const hum = params[1] || '';
					const short = params[2] || '';
					// 使用CSS样式来设置marker的形状为方形
					const temMarkerStyle =
						'display: inline-block; width: 5px; height: 14px; margin-right:3px; background-color: ' +
						tem.color +
						';';
					const humMarkerStyle =
						'display: inline-block; width: 5px; height: 14px; margin-right:3px; background-color: ' +
						hum.color +
						';';
					const shortMarkerStyle =
						'display: inline-block; width: 5px; height: 14px; margin-right:3px; background-color: ' +
						short.color +
						';';
					const temContent = tem
						? `${'<span style="' + temMarkerStyle + '"></span>'} 新订单: ${tem.value ?? ''}元 <br />`
						: '';
					const humContent = hum
						? `${'<span style="' + humMarkerStyle + '"></span>'} 长险新单: ${hum.value ?? ''}元 <br />`
						: '';
					const shortContent = short
						? `${'<span style="' + shortMarkerStyle + '"></span>'} 短险新单: ${short.value ?? ''}元 <br />`
						: '';
					return `${time}<br/>${temContent}${humContent}${shortContent}`;
				},
			},
			legend: {
				icon: 'stack',
				itemWidth: 10,
				itemHeight: 5,
				textStyle: {
					fontSize: 14,
					color: '#e0e1e2', // 设置字体颜色
					padding: [10, 10], // 设置文字与图例的距离
				},
				itemStyle: {
					borderWidth: 0,
				},
				formatter: function (name) {
					return name + ' ';
				},
				itemGap: 20, // 设置图例项之间的间距
			},
			grid: {
				left: '6%',
				right: '4%',
				bottom: '20%',
				top: '10%',
				containLabel: true,
			},
			xAxis: {
				type: 'category',
				boundaryGap: true,
				axisLine: {
					lineStyle: {
						color: 'rgba(2, 119, 175)',
						width: 2,
						type: 'solid',
					},
					show: true,
					onZero: false,
				},
				axisLabel: {
					color: 'rgba(207, 219, 230)',
				},
				data: time,
			},
			yAxis: [
				{
					name: '',
					type: 'value',
					min: 'dataMin',
					splitLine: {
						interval: 0,
						show: true,
						lineStyle: {
							color: 'rgba(6, 88, 142)',
							width: 2,
							type: [6, 3],
						},
					},
					axisTick: {
						show: false,
					},
					axisLine: {
						show: false,
					},
					axisLabel: {
						color: 'rgba(207, 219, 230)',
					},
					position: 'left',
				},
			],
			series: data.map((i) => {
				return {
					name: i.name,
					type: 'line',
					showSymbol: true,
					smooth: true,
					symbol: 'none',

					// 设置阈值线
					markLine: {
						silent: true,
						symbol: 'none',
						label: {
							padding: [0, 0, 0, -50],
						},
						lineStyle: {
							type: 'dashed',
							width: 2,
							color: 'orange',
						},
						data: [
							{
								yAxis: threshold,
							},
						],
					},
					data: i.data,
				};
			}),
		};

		let myChart = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
		myChart.setOption(option);
	}
}

export default LineChart;
