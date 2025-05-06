// background.js

// Запам’ятовує час старту розширення
const extensionLoadedAt = Date.now();

let pendingDownload = null;
let skipNextDownload = false;  // прапорець

chrome.downloads.onCreated.addListener((downloadItem) => {
  // Якщо ми самі ініціювали завантаження (skipNextDownload == true), не скасовуємо.

  // Ігноруємо старі завантаження (до старту розширення)
  const itemStart = new Date(downloadItem.startTime).getTime();
  if (itemStart < extensionLoadedAt) {
    // console.log('⏩ Пропускаємо старе завантаження:', downloadItem.startTime);
    return;
  }

  // Ігноруємо завантаження, створені іншими розширеннями
  if (downloadItem.byExtensionId) {
    // console.log('⏩ Пропускаємо завантаження від розширення:', downloadItem.byExtensionId);
    return;
  }

  if (skipNextDownload) {
    skipNextDownload = false; // скидаємо прапорець після першої обробки
    // console.log("Завантаження створене власним розширенням => не скасовуємо");
    return;
  }

  // Інакше це завантаження ззовні – скасовуємо та відкриваємо форму вибору.
  chrome.downloads.cancel(downloadItem.id, () => {
    // console.log("Автоматичне завантаження скасовано.");
  });

  // Зберігаємо дані про файл, щоби згодом дати змогу юзеру вирішити,
  // куди його зберігати.
  pendingDownload = downloadItem;

  // Відкриваємо нашу сторінку вибору у новій вкладці.
  chrome.tabs.create({
    url: chrome.runtime.getURL("choose.html")
  });
});

// Слухаємо повідомлення від choose.html
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!pendingDownload) {
    // Якщо чомусь немає збереженого файлу, повідомляємо про помилку
    sendResponse({ status: "error", message: "Немає файлу для завантаження." });
    return true;
  }

  if (request.action === "downloadToPC") {
    // Користувач вирішив завантажити на ПК
    // Викликаємо метод chrome.downloads.download() вручну,
    // щоб тепер справді викликати діалог "Save As"
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
        console.error("Помилка при завантаженні на Drive:", err);
        sendResponse({ status: "error", message: err.toString() });
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
