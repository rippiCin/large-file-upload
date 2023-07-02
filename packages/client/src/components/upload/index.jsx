import React, { useState } from 'react';
// import { INIT } from 'constant';
import {
  Button,
  // message,
  Row,
  Col,
  Input,
} from 'antd';
import { request, createFileChunk, mergeRequest } from '@/utils';

const Upload = () => {
  // const [uploadStatus, setUploadStatus] = useState(INIT);
  const [currentFile, setCurrentFile] = useState();
  const [fileChunks, setFileChunks] = useState([]);
  console.log(fileChunks);

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setCurrentFile(file);
    }
  };

  const uploadChunks = (chunks) => {
    const requestList = chunks
      .map(({ chunk, hash }) => {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', hash);
        formData.append('filename', currentFile.name);
        return { formData };
      })
      .map(({ formData }) => {
        return request({
          url: 'http://localhost:3000/upload',
          data: formData,
        });
      });
    Promise.all(requestList).then(() => {
      mergeRequest(currentFile.name);
    });
  };

  const handleUpload = () => {
    if (!currentFile) return;
    const fileChunkList = createFileChunk(currentFile);
    const chunks = fileChunkList.map(({ file }, index) => ({
      chunk: file,
      hash: `${currentFile.name}-${index}`,
    }));
    setFileChunks(chunks);
    uploadChunks(chunks);
  };

  return (
    <div className="upload">
      <Row>
        <Col span={12}>
          <Input type="file" style={{ width: 300 }} onChange={handleChange} />
          <Button style={{ marginLeft: 10 }} type="primary" onClick={handleUpload}>
            上传
          </Button>
        </Col>
      </Row>
    </div>
  );
};

export default Upload;
