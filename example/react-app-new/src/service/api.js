import { request } from '../utils/request';

/** 部件 */
export const getParts = () => {
	return request('post', `/part/list-parts`); // 获取部件列表 ✅
};

