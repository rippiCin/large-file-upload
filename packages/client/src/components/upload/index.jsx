import React, { useState, useRef } from 'react';
// import { INIT } from 'constant';
import {
  Button,
  // message,
  Row,
  Col,
  Input,
  Progress,
} from 'antd';
import { request, createFileChunk, mergeRequest, filterUploadedChunk } from '@/utils';

const Upload = () => {
  // const [uploadStatus, setUploadStatus] = useState(INIT);
  // 当前需要上传的文件信息
  const [currentFile, setCurrentFile] = useState();
  // 当前需要上传的文件的切片
  const [fileChunks, setFileChunks] = useState([]);
  // 计算出来的hash值
  const [hash, setHash] = useState();
  // 当前已经完成上传的切片数
  const [finishCount, setFinishCount] = useState(0);
  // 当前hash计算进度
  const [hashPercentage, setHashPercentage] = useState(0);
  const requestingList = useRef([]);
  const worker = useRef();

  // 获取文件上传进度 contenthash占25 上传占75 避免在转hash时进度条一直为0，优化感官体验
  const getPercentage = () => {
    const total = fileChunks.length;
    // hash的进度百分比
    const hashPercent = hashPercentage * 25;
    // 都未开始时 进度为0
    if (total === 0 && hashPercent === 0) return 0.0;
    // 转hash时 返回hash进度
    if (total === 0) return hashPercent.toFixed(1);
    // 文件上传的进度百分比
    const fileUploadPercent = (finishCount / total) * 75;
    return (hashPercent + fileUploadPercent).toFixed(1);
  };

  // 完成选择文件后，记录文件信息以及初始化切片和进度
  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setFinishCount(0);
      setFileChunks([]);
      setHashPercentage(0);
      setCurrentFile(file);
    }
  };

  // 每一个切片完成上传都更新一下进度
  const handleProgress = () => {
    setFinishCount((pre) => pre + 1);
  };

  // 开启webworker，进行计算文件contenthash
  const calculateHash = (chunks) => {
    return new Promise((resolve) => {
      // 添加worker属性
      worker.current = new Worker('/public/worker.js');
      worker.current.postMessage({ chunks });
      worker.current.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercentage(percentage);
        if (hash) {
          resolve(hash);
        }
      };
    });
  };

  // 校验文件是否已经上传过
  const validateFileIsUploaded = async (filename, fileHash) => {
    const { data } = await request({
      url: 'http://localhost:3000/validate',
      headers: {
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        filename,
        fileHash,
      }),
    });
    return JSON.parse(data);
  };

  // 上传切片
  const uploadChunks = (chunks) => {
    const requestList = chunks
      .map(({ chunk, hash, fileHash }) => {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', hash);
        formData.append('filename', fileHash);
        return { formData };
      })
      .map(({ formData }) => {
        return request({
          url: 'http://localhost:3000/upload',
          data: formData,
          requestList: requestingList.current,
        }).then(() => {
          handleProgress();
        });
      });
    console.log('requestList', requestList);
    Promise.all(requestList).then(() => {
      mergeRequest({ hash: chunks[0].fileHash, name: currentFile.name });
    });
  };

  // 进行文件切片以及计算文件的contenthash
  const handleUpload = async () => {
    if (!currentFile) return;
    // 将文件切片
    const fileChunkList = createFileChunk(currentFile);
    const curHash = await calculateHash(fileChunkList);
    const { shouldUpload, uploadedList } = await validateFileIsUploaded(currentFile.name, curHash);
    if (!shouldUpload) {
      setFinishCount(fileChunkList.length);
      setFileChunks(fileChunkList);
      return;
    }
    setHash(curHash);
    // 需要进行上传的切片
    const chunks = fileChunkList.map(({ file }, index) => ({
      chunk: file,
      fileHash: curHash,
      hash: `${curHash}-${index}`,
    }));
    setFileChunks(chunks);
    uploadChunks(filterUploadedChunk(chunks, uploadedList));
  };

  // 暂停上传
  const handlePause = () => {
    while (requestingList.current.length) {
      requestingList.current.pop().abort();
    }
  };

  // 恢复上传
  const handleResume = async () => {
    const { uploadedList } = await validateFileIsUploaded(currentFile.name, hash);
    await uploadChunks(filterUploadedChunk(fileChunks, uploadedList));
  };

  return (
    <div className="upload">
      <Row>
        <Col span={24}>
          <Input type="file" style={{ width: 300 }} onChange={handleChange} />
          <Button style={{ marginLeft: 10 }} type="primary" onClick={handleUpload}>
            上传
          </Button>
          <Button style={{ marginLeft: 10 }} type="primary" onClick={handlePause}>
            暂停上传
          </Button>
          <Button style={{ marginLeft: 10 }} type="primary" onClick={handleResume}>
            恢复上传
          </Button>
        </Col>
        <Col span={24}>
          <Progress percent={getPercentage()} />
        </Col>
      </Row>
    </div>
  );
};

export default Upload;
