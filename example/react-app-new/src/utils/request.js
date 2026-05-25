import axios from 'axios';
import qs from 'qs';
import { message } from 'antd';

const baseUrl = '';
const apiToken = localStorage.getItem('token');
axios.defaults.timeout = 10000;
axios.defaults.headers.common['Authorization'] = 'Bearer ' + apiToken;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// 添加请求拦截器
axios.interceptors.request.use(
	(config) => {
		const apiToken = localStorage.getItem('token');
		if (apiToken) {
			config.headers.Authorization = apiToken; // 带token请求
		} else {
			// console.log('没有token');
			// window.location.href = '/#/login';
		}
		return config;
	},
	(error) => {
		console.log(error);
		return Promise.reject(error);
	}
);

// 响应拦截
axios.interceptors.response.use(
	(config) => {
		return config;
	},
	(error) => {
		const stutas = error.response && error.response.status;
		if (stutas === 400) {
		}
		if (stutas === 401) {
			// message.info('登录过期,请重新登录!');
		}
		if (stutas === 403) {
		}
		if (stutas === 404) {
		}
		if (stutas === 500) {
		}
		if (stutas === 503) {
		}
		if (stutas === 10001) {
		}
		return Promise.reject(error);
	}
);

// 定义统一的请求函数
let hasShownLoginExpired = false; //跟踪是否已经显示过提示
export const request = (method, url, data = {}, type) => {
	const resData = type === 'formData' ? qs.stringify(data) : data;
	const config = {
		method,
		url: baseUrl + url,
		...(method === 'get' || method === 'delete' ? { params: data } : { data: resData }),
	};

	return axios
		.request(config)
		.then((response) => {
			// 在这里可以对响应进行拦截、转换和处理
			return response.data;
		})
		.catch((error) => {
			console.log(error, 'error');
			const code = error?.response?.status;
			if (code && code == 401) {
				localStorage.clear();
				sessionStorage.clear();
				if (!hasShownLoginExpired) {
					hasShownLoginExpired = true;
					// message.info('登录过期,请重新登录!');
					message.info(error?.response?.data.message);
				}
			} else {
				message.error(error.message);
			}
			// 在这里可以处理请求发生的错误
			throw error;
		});
};
