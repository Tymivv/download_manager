// background.js

// час старту розширення
const extensionLoadedAt = Date.now();
// інформація про завантаження
let pendingDownload = null;


// Перехоплює подію перед відображенням діалогу «Зберегти як»
chrome.downloads.onDeterminingFilename.addListener(downloadItem => {
  const start = new Date(downloadItem.startTime).getTime();
    // Ігнорує старі завантаження (до старту розширення)
  // if (start < extensionLoadedAt) return;
    // Ігнорує завантаження від будь-яких розширень
  if (downloadItem.byExtensionId) return;
  chrome.downloads.cancel(downloadItem.id, () => {
    // if (chrome.runtime.lastError) {
    //   console.warn('cancel error:', chrome.runtime.lastError.message);
    // } else {
    //   console.log('✋ Завантаження скасовано у onDeterminingFilename');
    // }
    // Зберігає для подальшої обробки об'єкт з інформацією про завантаження
    pendingDownload = downloadItem;
    // Відкриває вікно вибору (choose.html)
    chrome.tabs.create({url: chrome.runtime.getURL('choose.html')});
  });
});


// Слухає повідомлення від choose.html
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!pendingDownload) {
    // Якщо нема збереженого файлу - помилка
    sendResponse({ status: "error", message: "Немає файлу для завантаження." });
    return true;
  }

  if (request.action === "downloadToPC") {
    // Користувач вирішив завантажити на ПК
    // Викликає метод chrome.downloads.download() вручну,
    // щоб викликати діалог "Save As"
    const fileUrl = pendingDownload.finalUrl || pendingDownload.url;

    skipNextDownload = true;
    chrome.downloads.download({
      url: fileUrl,
      saveAs: true  // Показує діалог "Save As"
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Помилка при download():", chrome.runtime.lastError);
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
      } else {
        // console.log("Почалось завантаження з ID:", downloadId);
        sendResponse({ status: "ok", downloadId });
      }
    });

    return true; // асинхронна відповідь
  }

  if (request.action === "uploadToDrive") {
    // Користувач вирішив залити на Drive
    const fileUrl = pendingDownload.finalUrl || pendingDownload.url;
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const dateStr = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
    
    const fileName = `Новий файл (${dateStr}).bin`;
    // const fileName = pendingDownload.filename || "file.bin";
    // console.log(pendingDownload.filename);

    fetch(fileUrl)
      .then(response => response.blob())
      .then(blob => uploadToDrive(blob, fileName))
      .then((driveResponse) => {
        console.log("Файл успішно залитий на Google Drive!", driveResponse);
        sendResponse({ status: "uploaded", details: driveResponse });
      })
      .catch(err => {
        // якщо це Error — беремо err.message, якщо об’єкт із полем message — err.message, інакше — JSON.stringify
        let msg;
        if (err instanceof Error) {
          msg = err.message;
        } else if (err && typeof err === "object" && err.message) {
          msg = err.message;
        } else {
          msg = JSON.stringify(err);
        }
        sendResponse({ status: "error", message: msg });
      });
    return true; // лишаємо канал open
  }

  return false;
});

// ===============================
// Функції для Google Drive
// ===============================
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error("Не вдалося отримати токен"));
      } else {
        resolve(token);
      }
    });
  });
}

async function uploadToDrive(blob, filename) {
  const token = await getAuthToken();
  const metadata = {
    name: filename,
    mimeType: blob.type || 'application/octet-stream'
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const base64Data = await blobToBase64(blob);
  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${metadata.mimeType}\r\n` +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    base64Data +
    closeDelim;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "multipart/related; boundary=" + boundary
      },
      body: multipartRequestBody
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Drive API Error: " + errText);
  }

  return response.json();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = e => reject(e);
    reader.onload = () => {
      // reader.result має вигляд: "data:...;base64,AAA..."
      const base64Marker = ";base64,";
      const dataUrl = reader.result;
      const index = dataUrl.indexOf(base64Marker) + base64Marker.length;
      const base64String = dataUrl.substring(index);
      resolve(base64String);
    };
    reader.readAsDataURL(blob);
  });
}
