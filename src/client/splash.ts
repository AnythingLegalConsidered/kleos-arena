import { context, requestExpandedMode } from '@devvit/web/client';

// The splash is the inline feed card: it must stay static and instant.
// Its only job is to sell the game and open the expanded webview.
const startButton = document.getElementById('start-button');
if (startButton instanceof HTMLButtonElement) {
  startButton.addEventListener('click', (event) => {
    requestExpandedMode(event, 'game');
  });
}

// Subtle personal touch when Reddit exposes a username; hidden otherwise.
const greeting = document.getElementById('greeting');
if (greeting instanceof HTMLElement && context.username) {
  greeting.textContent = `Salut u/${context.username}`;
  greeting.hidden = false;
}
