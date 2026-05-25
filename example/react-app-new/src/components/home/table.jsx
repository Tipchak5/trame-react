import { useState, useEffect } from 'react';
import { Table } from 'antd';

function realTimeTable(props) {
	const columns = [
		{
			title: '模拟参数',
			dataIndex: 'name',
			key: 'name',
			align: 'center',
			ellipsis: {
				showTitle: false,
			},
		},
		{
			title: '数值',
			dataIndex: 'data',
			key: 'data',
			align: 'center',
			ellipsis: {
				showTitle: false,
			},
		},
	];
	const [dataSource, setDataSource] = useState([
		{ name: '速度', data: '0.2 km/h' },
		{ name: '高度', data: '1400 m' },
		{ name: '温度', data: '0 ℃' },
		{ name: '高压泄漏压力', data: '0 Mpa' },
	]);

	return (
		<Table
			style={{ marginTop: '38px', width: '100%' }}
			className='tableCom overAuto'
			rowKey={'name'}
			columns={columns}
			dataSource={dataSource}
			pagination={false}
		/>
	);
	/** 分页 */
}

export default realTimeTable;
