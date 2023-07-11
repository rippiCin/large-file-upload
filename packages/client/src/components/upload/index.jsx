import React, { useState, useRef } from 'react';
import Proptypes from 'prop-types';
import { INIT, PAUSE, UPLOADING, FAIL, SUCCESS, DEFAULT_SIZE } from 'constant';
import { Button, message, Row, Col, Input, Progress, Modal, Space } from 'antd';
import { request, createFileChunk, mergeRequest, filterUploadedChunk } from '@/utils';
import uploadingFiles from '@/store';

const Upload = ({ splitSize }) => {
  // 上传状态
  const [uploadStatus, setUploadStatus] = useState(INIT);
  // 当前需要上传的文件信息
  const [currentFile, setCurrentFile] = useState();
  // 当前已经完成上传的切片数
  const [finishCount, setFinishCount] = useState(0);
  // 当前hash计算进度
  const [hashPercentage, setHashPercentage] = useState(0);
  // 当前需要上传的文件的切片
  const fileChunks = useRef([]);
  // 计算出来的hash值
  const hash = useRef();
  const requestingList = useRef([]);
  const worker = useRef();
  const retryFunc = useRef();

  // 获取文件上传进度 contenthash占25 上传占74 避免在转hash时进度条一直为0，优化感官体验 合并占最后的1
  const getPercentage = () => {
    const total = fileChunks.current?.length;
    // hash的进度百分比
    const hashPercent = hashPercentage * 25;
    // 都未开始时 进度为0
    if (total === 0 && hashPercent === 0) return 0.0;
    // 转hash时 返回hash进度
    if (total === 0) return hashPercent.toFixed(1);
    // 文件上传的进度百分比
    const fileUploadPercent = (finishCount / total) * 74;
    return (hashPercent + fileUploadPercent).toFixed(1);
  };

  // 重置 一般是重新选择文件或者合并失败才调用
  const reset = () => {
    // 重置时，如果存在hash说明是合并失败导致需要重新上传/暂停上传后重新选择文件
    if (hash.current) {
      // 需要将该文件从记录中删除，这样才能重新上传
      uploadingFiles.deleteUploadingFile(hash.current);
      hash.current = null;
    }
    setUploadStatus(INIT);
    setFinishCount(0);
    fileChunks.current = [];
    setHashPercentage(0);
  };

  // 完成选择文件后，记录文件信息以及初始化切片和进度
  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      reset();
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
        })
          .then(() => {
            handleProgress();
          })
          .catch(() => {
            // 若上传异常，直接进行停止操作 并出现重试按钮
            handlePause();
            setUploadStatus(FAIL);
            retryFunc.current = handleResume;
          });
      });
    Promise.all(requestList).then(() => {
      mergeRequest({ hash: chunks[0].fileHash, name: currentFile.name })
        .then(() => {
          // 合并成功了，需要将本文件从记录中去掉
          uploadingFiles.deleteUploadingFile(hash.current);
          hash.current = null;
          // 并且将进度条设置为100
          setUploadStatus(SUCCESS);
        })
        .catch(() => {
          // 合并文件失败只能选择重传
          reset();
          message.error('上传文件失败，请重新上传');
        });
    });
  };

  // 校验文件是否已经上传过
  const validateFileIsUploaded = (filename, fileHash) => {
    return request({
      url: 'http://localhost:3000/validate',
      headers: {
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        filename,
        fileHash,
      }),
    });
  };

  // 校验文件是否已经上传过，且校验成功后进行上传文件的前置工作 重新校验的方法
  const validateFile = (fileChunkList, curHash) => {
    validateFileIsUploaded(currentFile.name, curHash)
      .then(({ data }) => {
        const { shouldUpload, uploadedList } = JSON.parse(data);
        if (!shouldUpload) {
          setUploadStatus(SUCCESS);
          return;
        }
        // 需要进行上传的切片
        const chunks = fileChunkList.map(({ file }, index) => ({
          chunk: file,
          fileHash: curHash,
          hash: `${curHash}-${index}`,
        }));
        fileChunks.current = chunks;
        uploadChunks(filterUploadedChunk(chunks, uploadedList));
      })
      .catch(() => {
        setUploadStatus(FAIL);
        // 若校验出错，出现重试按钮，并保存重试的方法
        retryFunc.current = () => {
          validateFile(fileChunkList, curHash);
        };
      });
  };

  // 进行文件切片以及计算文件的contenthash
  const handleUpload = async () => {
    if (!currentFile) {
      message.error('请选择需要上传的文件');
      return;
    }
    setUploadStatus(UPLOADING);
    // 将文件切片
    const fileChunkList = createFileChunk(currentFile, splitSize);
    const curHash = await calculateHash(fileChunkList);
    retryFunc.current = () => {
      // 在上传前，前端先校验是否有相同的文件正在上传，若无则进行上传
      if (uploadingFiles.checkFileIsUploading(curHash)) {
        message.error('该文件正在上传中，请勿重复上传');
        setUploadStatus(FAIL);
        return;
      } else {
        hash.current = curHash;
        uploadingFiles.addUploadingFile(curHash);
        validateFile(fileChunkList, curHash);
      }
    };
    retryFunc.current();
  };

  // 暂停上传
  const handlePause = () => {
    while (requestingList.current.length) {
      requestingList.current.pop().abort();
    }
  };

  // 恢复上传
  const handleResume = () => {
    setUploadStatus(UPLOADING);
    validateFileIsUploaded(currentFile.name, hash.current).then(({ data }) => {
      const { uploadedList } = JSON.parse(data);
      uploadChunks(filterUploadedChunk(fileChunks.current, uploadedList));
    });
  };

  // 重试
  const handleRetry = () => {
    setUploadStatus(UPLOADING);
    retryFunc.current();
  };

  return (
    <div className="upload">
      <Row>
        <Col span={24}>
          <Space gutter={[10]}>
            <Input type="file" style={{ width: 300 }} onChange={handleChange} />
            <Button type="primary" onClick={handleUpload} disabled={uploadStatus !== INIT}>
              上传
            </Button>
            <Button
              type="primary"
              disabled={uploadStatus !== UPLOADING}
              onClick={() => {
                if (!fileChunks.current?.length) {
                  Modal.confirm({
                    title: '提示',
                    content: '此时暂停，上传进度将会清空，请确定是否要取消上传',
                    onOk() {
                      reset();
                      worker.current.terminate?.();
                      setHashPercentage(0);
                    },
                  });
                } else {
                  handlePause();
                  setUploadStatus(PAUSE);
                }
              }}
            >
              暂停上传
            </Button>
            {uploadStatus === PAUSE && (
              <Button type="primary" onClick={handleResume}>
                恢复上传
              </Button>
            )}
            {uploadStatus === FAIL && (
              <Button type="primary" onClick={handleRetry}>
                重试
              </Button>
            )}
          </Space>
        </Col>
        <Col span={24}>
          <Progress percent={uploadStatus === SUCCESS ? 100.0 : getPercentage()} />
        </Col>
      </Row>
    </div>
  );
};

Upload.propTypes = {
  splitSize: Proptypes.number,
};

Upload.defaultProps = {
  splitSize: DEFAULT_SIZE,
};

export default Upload;
