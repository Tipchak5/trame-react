import { useState, useEffect, useRef } from 'react';
import { Upload, Button, message, Progress } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { BorderBox10 } from '@jiaminghi/data-view-react';
import './upload.css';

function uploadIndex() {
	const [uploading, setUploading] = useState(false); // 上传状态
	const [progress, setProgress] = useState(0); // 上传进度
  const [fileList, setFileList] = useState([]); // 文件列表

	return (
		<div className='uploadBox'>
			<BorderBox10
				style={{
					width: 800,
					height: 360,
				}}
				color={['#11D6E0', '#037cb1']}
			>
				<div className='container'>
					<div style={{ width: '650px' }}>
						<div className='text'>请上传模型文件</div>
						<div className='upload-item'>
							<div style={{ textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
								<Upload
									fileList={fileList}
									onChange={handleChange}
									beforeUpload={() => false} // 不自动上传
								>
									<Button className='upload-button' icon={<UploadOutlined />}>
										选择文件
									</Button>
								</Upload>

								{fileList.length > 0 && (
									<div style={{ marginTop: 20 }}>
										<Button
											type='primary'
											onClick={handleUpload}
											disabled={uploading}
											style={{ marginTop: 20 }}
										>
											{uploading ? '正在上传...' : '开始上传'}
										</Button>
									</div>
								)}

								{uploading && (
									<div style={{ marginTop: 20 }}>
										<Progress percent={progress} />
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</BorderBox10>
		</div>
	);

	/** 上传文件 */
	async function handleUpload() {
		const file = fileList[0]; // 假设只上传一个文件
		if (!file) return;

		const formData = new FormData();
		formData.append('file', file);

		setUploading(true);
		setProgress(0); // 初始化进度

		try {
			await axios.post('https://your-api-endpoint.com/upload', formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				onUploadProgress: (progressEvent) => {
					const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
					setProgress(percent); // 更新进度条
				},  
			});

			message.success(`${file.name} 文件上传成功`);
			setUploading(false);
		} catch (error) {
			message.error(`${file.name} 文件上传失败`);
			setUploading(false);
		}
	}

  /** 监听上传文件 */
	function handleChange({ fileList: newFileList }) {
    setFileList(newFileList); // 更新文件列表
    
    if (fileList.length == 0 ) {
      set
    }
	}
}

export default uploadIndex;
