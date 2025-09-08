import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { TrameIframeApp } from '@kitware/trame-react';

// 防抖
function debounce(func, wait) {
	let timeout;
	return function (...args) {
		const context = this;

		clearTimeout(timeout); // Clears the previous timeout
		timeout = setTimeout(() => func.apply(context, args), wait); // Sets a new timeout
	};
}

// 深度比较两个对象或值是否相等
function deepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;
	if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null)
		return false;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;
	for (let key of keys1) {
		if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
			return false;
		}
	}
	return true;
}

// 遍历比较前端和后端状态是否一致
function stateIsSync(localState, trameState) {
	const localStateKeys = Object.keys(localState);
	const trameStatekeys = Object.keys(trameState);

	for (let localKey of localStateKeys) {
		if (
			!trameStatekeys.includes(localKey) ||
			!deepEqual(localState[localKey], trameState[localKey])
		) {
			return false;
		}
	}

	return true;
}

const Viewer = ({ viewerId, url }) => {
	const trameCommunicator = useRef(null);
	const synchronizeTrameState = useRef(null);
	const [testData, setTestData] = useState('');

	const [viewerState, setViewerState] = useState({
		resolution: 20,
		interaction_mode: 'interact',
	});

	useEffect(() => {
		synchronizeTrameState.current = debounce((viewerState) => {
			if (!trameCommunicator.current) {
				return;
			}
			// 获取当前 Trame 后端的状态
			trameCommunicator.current.state.get().then((trame_state) => {
				// 比较前端状态和后端状态是否同步
				if (!stateIsSync(viewerState, trame_state)) {
					console.log(trame_state, 'trame_state', viewerState);
					// 如果不同步，更新后端状态
					trameCommunicator.current.state.update(viewerState);
				}
			});
		}, 25);
	}, []); // 后端传递数据

	useEffect(() => {
		synchronizeTrameState.current(viewerState);
	}, [viewerState]);

	const onViewerReady = (comm) => {
		trameCommunicator.current = comm;

		trameCommunicator.current.state.onReady(() => {
			trameCommunicator.current.state.watch(['interactor_settings'], (interactor_settings) => {
				console.log({ interactor_settings });
			}); // 从后端获取数据

			trameCommunicator.current.state.watch(
				['resolution', 'interaction_mode'],
				(resolution, interaction_mode) => {
					setViewerState((prevState) => ({
						...prevState,
						resolution,
						interaction_mode,
					}));
				}
			);

			// 监听后端数据testData
			trameCommunicator.current.state.watch(['testData'], (value) => {
				console.log('监听后端数据testData:', value);
				setTestData(value); // 更新组件状态
			});
		});
	};

	return (
		<div className='viewer' style={{ height: '80%' }}>
			<Button
				type='primary'
				onClick={() => {
					const newData = {
						testKey: 'testValue',
						timestamp: Date.now(),
						resolution: viewerState.resolution,
					};

					sendStateUpdateToBackend(newData); // 通过 state.update 发送数据
				}}
			>
				State.Update发送数据
			</Button>

			{/* 按钮通过触发器发送数据 */}
			<Button
				style={{ marginLeft: '10px' }}
				onClick={() => {
					const newData = {
						test: 'triggerTest',
					};
					sendToPy(newData); // 通过 trigger 发送数据
				}}
			>
				Trigger发送数据
			</Button>

			{/* 获取后端数据 */}
			<Button
				danger
				style={{ marginLeft: '10px' }}
				onClick={() => {
					trameCommunicator.current.trigger('update_data');
				}}
			>
				获取后端数据 ———— {testData ? testData : ''}
			</Button>

			<Button
				style={{ marginLeft: '10px' }}
				onClick={() => {
					getAllData();
				}}
			>
				一次性获取后端数据
			</Button>

			{/* 模式视图 */}
			<div style={{ height: '80%' }}>
				<TrameIframeApp iframeId={viewerId} url={url} onCommunicatorReady={onViewerReady} />
			</div>
		</div>
	);

	/** 传递数据到后端 */
	function sendStateUpdateToBackend(newData) {
		if (trameCommunicator.current) {
			trameCommunicator.current.state.update(newData);
		} else {
			console.error('Trame communicator is not ready.');
		}
	}

	function sendTriggerToBackend(params) {}

	/** 使用 trigger 将数据发送到后端 */
	function sendToPy(newData) {
		if (trameCommunicator.current) {
			trameCommunicator.current
				.trigger('process_data', newData) // 确保这里发送的数据结构是后端期望的结构
				.then((response) => {
					console.log('Response from backend:', response);
				})
				.catch((error) => {
					console.error('Error triggering process_data:', error);
				});
		} else {
			console.error('Trame communicator is not ready.');
		}
	}

	/** 从后端获取数据 */
	function fetchDataFromBackend() {
		if (trameCommunicator.current) {
			trameCommunicator.current
				.trigger('fetch_data')
				.then((data) => {
					console.log('从后端获取数据', data);
				})
				.catch((err) => {
					console.error('Error fetching data:', err);
				});
		}
	}

	/** 获取后端所有数据 */
	function getAllData() {
		if (!trameCommunicator.current) {
			return;
		}
		// 获取当前 Trame 后端的状态
		trameCommunicator.current.state.get().then((trame_state) => {
			console.log(trame_state, 'trame_state');
		});
	}

	function resetCamera() {
		console.debug('resetting camera');
		trameCommunicator.current.trigger('raise_error').catch((err) => {
			throw err;
		});
		trameCommunicator.current.trigger('reset_camera');
	}

	function resetResolution() {
		console.debug('resetting resolution');
		trameCommunicator.current.trigger('reset_resolution');
	}
};

export default Viewer;
