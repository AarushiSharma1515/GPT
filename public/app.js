const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');
const sendBtn = document.getElementById('send-btn');
const welcomeMessage = document.querySelector('.welcome-message');

let conversationHistory = [];

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userText = messageInput.value.trim();
  if (!userText) return;

  if (welcomeMessage) welcomeMessage.style.display = 'none';

  appendMessage('user', userText);
  messageInput.value = '';
  
  const msgElement = appendMessage('ai', ''); 
  
  sendBtn.disabled = true;
  let fullAiResponse = "";

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, history: conversationHistory })
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = ''; 

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop(); 
        
        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const dataStr = chunk.replace('data: ', '');
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error); 
              
              if (data.text) {
                fullAiResponse += data.text;
                msgElement.textContent = fullAiResponse; 
                chatContainer.scrollTop = chatContainer.scrollHeight;
              }
            } catch (err) {
              if (err.name !== 'SyntaxError') throw err;
            }
          }
        }
      }
    }

    if (fullAiResponse) {
      conversationHistory.push({ role: 'user', parts: [{ text: userText }] });
      conversationHistory.push({ role: 'ai', parts: [{ text: fullAiResponse }] });
    }

  } catch (error) {
    // Corrected combined error handler
    if (msgElement) {
      if (error.message.includes('429')) {
        msgElement.textContent = "⚠️ Rate limit reached: Please wait a few seconds before trying again.";
      } else {
        msgElement.textContent = `⚠️ Error: ${error.message}`;
      }
    }
    console.error('[Frontend] Crash:', error);
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
});

// Modified to return the exact HTML element instead of using IDs
// Modified to inject your custom avatars and handle the loading animation
function appendMessage(sender, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);

  // Create the avatar image element
  const avatar = document.createElement('img');
  avatar.src = sender === 'ai' ? 'images/ai.png' : 'images/user.png';
  avatar.className = `${sender}-avatar`;
  avatar.alt = `${sender} profile`;

  if (sender === 'ai') {
    // Keep the editorial label
    const label = document.createElement('div');
    label.className = 'ai-label';
    label.textContent = 'Gemini';
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    // If text is empty, inject the loading gif
    if (!text) {
      const loader = document.createElement('img');
      loader.src = 'images/loading.gif';
      loader.className = 'loading-spinner';
      loader.alt = 'Loading...';
      contentDiv.appendChild(loader);
    } else {
      contentDiv.textContent = text;
    }
    
    messageDiv.appendChild(contentDiv);
  } else {
    // User layout: text first, then avatar
    messageDiv.textContent = text;
    messageDiv.appendChild(avatar);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Return the content element so the stream can target it
  return messageDiv.querySelector('.content');
}
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}