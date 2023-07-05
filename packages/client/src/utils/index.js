import { DEFAULT_SIZE } from 'constant';

const request = ({ url, method = 'post', data, headers = {}, requestList }) => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]));
    xhr.send(data);
    xhr.onload = (e) => {
      // 请求成功时将当前xhr从list中剔除
      if (requestList?.length) {
        const xhrIndex = requestList.findIndex((req) => req === xhr);
        requestList.splice(xhrIndex, 1);
      }
      resolve({
        data: e.target.response,
      });
    };
    // 暴露当前xhr给外部
    requestList?.push(xhr);
  });
};

// 创建切片
const createFileChunk = (file, size = DEFAULT_SIZE) => {
  const fileChunkList = [];
  let cur = 0;
  while (cur < file.size) {
    fileChunkList.push({ file: file.slice(cur, cur + size) });
    cur += size;
  }
  return fileChunkList;
};

const mergeRequest = ({ hash, name }, size = DEFAULT_SIZE) => {
  request({
    url: 'http://localhost:3000/merge',
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({
      size,
      hash,
      name,
    }),
  });
};

const filterUploadedChunk = (chunks, uploadedList) => {
  return chunks.filter(({ hash }) => !uploadedList.includes(hash));
};

export { request, createFileChunk, mergeRequest, filterUploadedChunk };
