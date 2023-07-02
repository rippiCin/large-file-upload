import { DEFAULT_SIZE } from 'constant';

const request = ({ url, method = 'post', data, headers = {} }) => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]));
    xhr.send(data);
    xhr.onload = (e) => {
      resolve({
        data: e.target.response,
      });
    };
  });
};

const createFileChunk = (file, size = DEFAULT_SIZE) => {
  const fileChunkList = [];
  let cur = 0;
  while (cur < file.size) {
    fileChunkList.push({ file: file.slice(cur, cur + size) });
    cur += size;
  }
  return fileChunkList;
};

const mergeRequest = (filename, size = DEFAULT_SIZE) => {
  request({
    url: 'http://localhost:3000/merge',
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({
      size,
      filename,
    }),
  });
};

export { request, createFileChunk, mergeRequest };
