// 这个store为记录当前应用正在执行上传的文件
// 每当文件解析hash完成后都需要来此store中检查是否有另外一个Upload组件正在上传相同的文件
// 若有则不允许开始上传
class UploadingFiles {
  constructor() {
    // 当前正在上传的文件的hash合集
    this.files = new Set();
  }

  // 正式开始上传文件时先将文件的hash存入记录中
  addUploadingFile = (fileHash) => {
    this.files.add(fileHash);
  };

  // 完成上传或放弃上传后删除掉该文件的记录，避免影响文件秒传和重传
  deleteUploadingFile = (fileHash) => {
    this.files.delete(fileHash);
  };

  // 上传前检测是否有记录，有则说明重复了
  checkFileIsUploading = (fileHash) => {
    return this.files.has(fileHash);
  };
}

const uploadingFiles = new UploadingFiles();

export default uploadingFiles;
