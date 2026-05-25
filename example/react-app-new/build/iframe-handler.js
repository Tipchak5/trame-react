// iframe-handler.js - 处理来自父窗口的消息

// 初始化 VTKViewerAPI 对象
window.VTKViewerAPI = {
  // 处理文件上传
  uploadFile: function(fileData) {
    console.log('VTKViewerAPI: 收到文件上传请求', fileData.fileName);
    
    // 这里添加实际的文件处理逻辑
    // 例如，将文件内容传递给 VTK.js 渲染器
    
    return {
      success: true,
      message: '文件上传成功'
    };
  }
};

// 监听来自父窗口的消息
window.addEventListener('message', function(event) {
  console.log('iframe 收到消息:', event.data);
  
  // 验证消息来源
  if (event.origin !== window.location.origin && event.origin !== 'http://localhost:3000') {
    console.warn('收到来自未知来源的消息:', event.origin);
    // 可以选择忽略非信任来源的消息
    // return;
  }
  
  const { action, data, id } = event.data;
  
  // 处理不同类型的操作
  if (action === 'uploadFile') {
    try {
      console.log('处理文件上传请求:', data.fileName);
      
      // 处理文件内容
      let fileContent = data.fileContent;
      let result;
      
      // 如果是 ArrayBuffer，转换为适当的格式
      if (fileContent instanceof ArrayBuffer || 
          (typeof fileContent === 'object' && fileContent.byteLength !== undefined)) {
        // 处理二进制数据
        console.log('处理二进制文件数据，大小:', data.fileSize);
        
        // 这里添加实际的二进制文件处理逻辑
        result = { success: true, message: '二进制文件上传成功' };
      } else {
        // 处理文本数据
        console.log('处理文本文件数据，大小:', data.fileSize);
        
        // 这里添加实际的文本文件处理逻辑
        result = { success: true, message: '文本文件上传成功' };
      }
      
      // 发送响应回父窗口
      event.source.postMessage({
        id: id,
        result: result
      }, '*');
      
    } catch (error) {
      console.error('处理文件上传时出错:', error);
      
      // 发送错误响应
      event.source.postMessage({
        id: id,
        result: {
          success: false,
          error: error.message || '处理文件时出错'
        }
      }, '*');
    }
  }
});

// 通知父窗口 API 已就绪
window.parent.postMessage({
  type: 'API_READY',
  message: 'VTKViewerAPI is ready'
}, '*');

console.log('iframe-handler.js 已加载，VTKViewerAPI 已初始化');