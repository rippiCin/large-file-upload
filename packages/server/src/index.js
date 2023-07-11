const http = require('http');
const fse = require('fs-extra');
const multiparty = require('multiparty');
const path = require('path');
const { extractExt } = require('./utils/index');
const server = http.createServer();

// 大文件存储的目录
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

// 返回已上传的所有的切片名
const createUploadList = async (fileHash) => {
  const fileFolder = `chunkDir${fileHash}`;
  return fse.existsSync(path.resolve(UPLOAD_DIR, fileFolder))
    ? await fse.readdir(path.resolve(UPLOAD_DIR, fileFolder))
    : [];
};

const resolvePost = (req) => {
  return new Promise((resolve) => {
    let chunk = '';
    req.on('data', (data) => {
      chunk += data;
    });
    req.on('end', () => {
      resolve(JSON.parse(chunk));
    });
  });
};

const pipeStream = (path, writeStream) => {
  return new Promise((resolve) => {
    const readStream = fse.createReadStream(path);
    readStream.on('end', () => {
      fse.unlinkSync(path);
      resolve();
    });
    readStream.pipe(writeStream);
  });
};

const mergeFileChunk = async (filePath, filename, size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, `chunkDir${filename}`);
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);
  // 并发写入文件
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      return pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 根据size在指定位置创建可写流
        fse.createWriteStream(filePath, {
          start: index * size,
        })
      );
    })
  );
  // 合并后删除保存切片的目录
  fse.rmdirSync(chunkDir);
};

server.on('request', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.status = 200;
    res.end();
    return;
  }

  // 切片全部上传完的通知接口
  if (req.url === '/merge') {
    try {
      const data = await resolvePost(req);
      const { hash, name, size } = data;
      const ext = extractExt(name);
      const filePath = path.resolve(UPLOAD_DIR, `${hash}${ext}`);
      await mergeFileChunk(filePath, hash, size);
      res.end(
        JSON.stringify({
          code: 0,
          message: 'file merged success',
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          code: 500,
          message: '文件上传失败，请重试',
        })
      );
    }
  }

  // 切片上传接口
  if (req.url === '/upload') {
    const multipart = new multiparty.Form();
    multipart.parse(req, async (err, fields, files) => {
      if (err) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            code: 500,
            message: '文件上传失败，请重试',
          })
        );
        return;
      }
      const [chunk] = files.chunk;
      const [hash] = fields.hash;
      const [filename] = fields.filename;
      // 创建临时文件夹用于存储chunk
      // 添加chunkDir前缀与文件名做区分
      // eslint-disable-next-line no-unreachable
      const chunkDir = path.resolve(UPLOAD_DIR, `chunkDir${filename}`);
      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }
      await fse.move(chunk.path, `${chunkDir}/${hash}`);
      res.end('received file chunk');
    });
  }

  // 校验文件是否已经上传过
  if (req.url === '/validate') {
    try {
      const data = await resolvePost(req);
      const { fileHash, filename } = data;
      const ext = extractExt(filename);
      const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
      const uploadedList = await createUploadList(fileHash);
      res.end(JSON.stringify({ shouldUpload: !fse.existsSync(filePath), uploadedList }));
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          code: 500,
          message: '校验出错，请重新选择文件进行上传',
        })
      );
    }
  }
});

server.listen(3000, () => console.log('listening port 3000'));
