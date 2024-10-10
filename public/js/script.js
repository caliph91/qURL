    document.getElementById('shortenForm').addEventListener('submit', function (event) {
      event.preventDefault();
      const url = document.getElementById('urlInput').value;
      const alias = document.getElementById('aliasInput').value;

      // Use fetch or any other method to make a request to your Node.js/Express API
      fetch(`/api/create?alias=${alias}&url=${url}`)
        .then(response => response.json())
        .then(data => {
          const resultDiv = document.getElementById('shortenResult');
          if (data.success) {
            resultDiv.innerHTML = `<div class="alert alert-success" role="alert">
                                     Shortened URL: <a href="${data.response.short}" target="_blank">${data.response.short}</a>
                                   </div>`;
          } else {
            resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">
                                     Error: ${data.error}
                                   </div>`;
          }
        })
        .catch(error => {
          console.error('Error:', error);
        });
    });

    async function getStatistics() {
      const response = await fetch('/api/status');
      const data = await response.json();
      const shortenCountElement = document.getElementById('shortenCount');
      shortenCountElement.textContent = `Total Shortened URLs: ${data.shorten}`;
    }

    getStatistics();
    setInterval(getStatistics, 5000);