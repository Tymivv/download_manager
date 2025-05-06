    // // При натисканні «Завантажити на ПК»
    // document.getElementById("btnSaveToPC").addEventListener("click", () => {
    //   chrome.runtime.sendMessage({ action: "downloadToPC" }, (response) => {
    //     if (!response) return;
    //     if (response.status === "ok") {
    //       alert("Запущено діалог 'Save As'!");
    //       window.close(); // Закриє вкладку, якщо треба
    //     } else {
    //       alert("Помилка: " + response.message);
    //     }
    //   });
    // });

    // // При натисканні «Завантажити на Drive»
    // document.getElementById("btnSaveToDrive").addEventListener("click", () => {
    //   chrome.runtime.sendMessage({ action: "uploadToDrive" }, (response) => {
    //     if (!response) return;
    //     if (response.status === "uploaded") {
    //       alert("Файл успішно завантажено на Google Drive!");
    //       window.close();
    //     } else {
    //       alert("Помилка: " + response.message);
    //     }
    //   });
    // });
    const statusDiv = document.getElementById("status");

    document.getElementById("btnSaveToPC").addEventListener("click", () => {
      // Наприклад, якщо робимо локальне завантаження
      chrome.runtime.sendMessage({ action: "downloadToPC" }, (response) => {
        if (!response) return;
        if (response.status === "ok") {
          alert("Запущено діалог 'Save As'!");
          window.close();
        } else {
          alert("Помилка: " + response.message);
        }
      });
    });

    document.getElementById("btnSaveToDrive").addEventListener("click", () => {
      // Показуємо індикатор
      statusDiv.innerHTML = '<div class="spinner"></div> Завантаження на Google Drive… будь ласка, зачекайте.';

      chrome.runtime.sendMessage({ action: "uploadToDrive" }, (response) => {
        if (!response) return;
        if (response.status === "uploaded") {
          statusDiv.innerHTML = 'Файл успішно завантажено на Google Drive!';
        } else if (response.status === "error") {
          statusDiv.innerHTML = 'Помилка: ' + response.message;
        }
      });
    });