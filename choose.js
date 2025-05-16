    const statusDiv = document.getElementById("status");
    const linkEl   = document.getElementById('drive-link');


    document.getElementById("btnSaveToPC").addEventListener("click", () => {
      // Наприклад, якщо робимо локальне завантаження
      chrome.runtime.sendMessage({ action: "downloadToPC" }, (response) => {
        if (!response) return;
        if (response.status === "ok") {
          // alert("Запущено діалог 'Save As'!");
          window.close();
        } else {
          alert("Помилка: " + response.message);
        }
      });
    });

    document.getElementById("btnSaveToDrive").addEventListener("click", () => {
      // Показуємо індикатор завантаження
      //statusDiv.innerHTML = '<div class="spinner"></div> Завантаження на Google Drive… будь ласка, зачекайте.';
      statusDiv.innerHTML = '<div class="loader"> Завантаження на Google Drive… будь ласка, зачекайте.</div>';

      chrome.runtime.sendMessage({ action: "uploadToDrive" }, (response) => {
        if (!response) return;
        if (response.status === "uploaded") {
          statusDiv.innerHTML = 'Файл успішно завантажено на Google Drive!';
          const a = document.createElement('a');
          a.href = `https://drive.google.com/file/d/${response.details.id}/view`;
          a.textContent = 'Відкрити файл на Google Диску';
          a.target = '_blank';
          linkEl.appendChild(a);
        } else if (response.status === "error") {
          statusDiv.innerHTML = 'Помилка: ' + response.message;
        }
      });
    });