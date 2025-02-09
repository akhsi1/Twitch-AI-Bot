const { default: ollama } = require('ollama');
const { fetchContext, examples, subContext } = require('./context');
const { llama3instructions, llama3examples } = require('./llama3instructions');
const { phi4instructions } = require ('./phi4instructions');

async function isQuestion(message) {
  message = 'Respond in true or false only. Respond "true" if the following message has a question, or "false" if not: ' + `"${message}"`;
  const response = await ollama.chat({
    model: 'phi4:14b-q8_0',
    num_ctx: 2048,
    messages: [{ role: 'user', content: message }],
  });

  console.log('is question?' + response.message.content);
  if (response.message.content.toLowerCase().includes('true')) {
    return true;
  } else {
    return false;
  }
}

async function processMessage(user, subscriber, message, isMentioned, generalChat) {
  try {
    var currentTime = new Date();
    const context = await fetchContext();
    var userPrompt = "";

    if (context === null) {
      throw new Error('Failed to fetch context');
    }

    // if (generalChat) {
    //   prompt = `Today's date is ${currentTime}.\n${context}\n${instructions}. Viewer "${user}" said: ${message} `
    // }

    var systemContext = `${context}\n${phi4instructions}.\n${examples}\nToday's date is ${currentTime}. This is the end of System Context.`;
    // var systemContext = `${context}\n${instructions}.\nToday's date is ${currentTime}. This is the end of System Context.`;


    //   deepseek-r1:32b(doesn't know about new world)  
    //   llama3.1:8b(bad)  
    //   mistral-small (very direct, not much hallucination) 
    //   qwen2.5:14b (more fun) 1
    //   gemma2:27b
    //   eas/nous-capybara:34b
    //   mistral-small:24b-instruct-2501-q4_K_M
    //   Qwen2.5-7B-Instruct-1M-GGUF:Q6_K_L
    //   phi4:14b-q8_0
    //   llama3.3:70b-instruct-q2_K
    //   Mistral-7B-Claude-Chat-GGUF:Q2_K

    var aiPrompt = `"${user}" typed in chat: "${message}". Please respond to the message based on your knowledge without assuming the information provided by the user is correct. Only use the system content as the source of truth`;

    const response = await ollama.generate({
      model: 'phi4:14b-q8_0',
      options: {
        num_ctx: 16384,
        temperature: 0
      },
      system: systemContext,
      prompt: aiPrompt,
      stream: false
    });

    console.log(response.response + '\nEVAL COUNT = ' +response.eval_count);

    if (isMentioned) {
      return `I’ll reply as I’m tagged, but it might be wrong. ` + response.response;
    }
    if (response.eval_count >= 70) {
      console.log('Eval count too large');
      return '[10]';
    }
    return response.response;
  } catch (error) {
    console.error('Error interacting with Ollama API:', error);
  }
}

async function processSubscription(user, isPrime, giftCount, recipient) {
  try {

    var aiPrompt = `"${user}" has subscribed!`;

    if (isPrime) {
      aiPrompt = `"${user}" has subscribed with Twitch Prime!`;
    }

    if (giftCount && giftCount >= 1) {
      aiPrompt = `"${user}" has gifted ${giftCount} subs!`;
    }

    if (recipient) {
      aiPrompt = `"${user}" has gifted ${recipient} a sub!`;
    }
    
    const response = await ollama.generate({
      model: 'mistral-small',
      options: {
        num_ctx: 2048,
      },
      system: subContext,
      prompt: aiPrompt,
      stream: false
    });

    console.log(response.response);
    return response.response;
  } catch (error) {
    console.error('Error interacting with Ollama API:', error);
  }

}

module.exports = {
  processMessage,
  isQuestion,
  processSubscription
};