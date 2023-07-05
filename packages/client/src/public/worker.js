self.importScripts('./spark-md5.min.js');

self.onmessage = (e) => {
  const { chunks } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percentage = 0;
  let count = 0;
  const loadNext = (index) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(chunks[index].file);
    reader.onload = (event) => {
      count += 1;
      spark.append(event.target.result);
      if (count === chunks.length) {
        self.postMessage({
          percentage: 1,
          hash: spark.end(),
        });
        self.close();
      } else {
        percentage = count / chunks.length;
        self.postMessage({ percentage });
        loadNext(count);
      }
    };
  };
  loadNext(0);
};
