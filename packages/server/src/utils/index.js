const extractExt = (filename) => {
  return filename.slice(filename.lastIndexOf('.'), filename.length);
};

module.exports = {
  extractExt,
};
