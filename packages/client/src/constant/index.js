const INIT = 0; // 初始状态
const PAUSE = 1; // 暂停状态
const UPLOADING = 2; // 正在上传状态
const SUCCESS = 3; // 成功状态
const FAIL = 4; // 失败状态

// 分片的大小的默认值，若使用者不传则采用以下值，10m
const DEFAULT_SIZE = 10 * 1024 * 1024;

export { INIT, PAUSE, UPLOADING, SUCCESS, FAIL, DEFAULT_SIZE };
