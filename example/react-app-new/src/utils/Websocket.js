export function useWebSocket(handleOpen, handleMessage) {
	const WS_ADDRESS = 'ws://172.16.15.10:8080/websocket/api';
	const ws = new WebSocket(WS_ADDRESS);
	const init = () => {
		if (WebSocket === undefined) {
			alert('您的浏览器不支持websocket');
		} else {
			bindEvent();
		}
	};

	function bindEvent() {
		ws.onopen = handleOpen;
		ws.onerror = handleError;
		ws.onmessage = handleMessage;
	}

	function handleError(e) {
		console.log('连接错误', e);
	}

	init();
	return ws;
}
