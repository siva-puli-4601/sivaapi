const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Configuration, OpenAIApi } = require('openai');
const ytdl = require('ytdl-core');
const fs = require('fs');
const { exec } = require('child_process');
const YouTubeTranscriptApi = require('youtube-transcript-api');
const readline = require('readline');

// Configure API keys
const genAI = new GoogleGenerativeAI('AIzaSyAIewGMqAtMEtZMZjDJgEPNEwh_Q74yfGw');

// Function to download and rename audio
function downloadAndRenameAudio(url, newName = 'audio1') {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp --extract-audio --audio-format mp3 --output "${newName}.%(ext)s" ${url}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      
      const files = fs.readdirSync('.');
      const audioFile = files.find(file => file.startsWith(newName) && file.endsWith('.mp3'));
      
      if (!audioFile) {
        console.error('Error: No downloaded audio file found.');
        return reject(new Error('No audio file found'));
      }
      
      const newFilePath = `./${audioFile}`;
      console.log(`New file path: ${newFilePath}`);
      resolve(newFilePath);
    });
  });
}

// Function to get transcript text
async function getTranscriptText(videoId) {
  try {
    const transcript = await YouTubeTranscriptApi.getTranscript(videoId, { lang: 'en' });
    const transcriptText = transcript.map(entry => entry.text).join(' ');
    return transcriptText;
  } catch (error) {
    console.error('Error occurred while getting transcript');
    console.log('Using OpenAI to convert the YouTube video into text');
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    await downloadAndRenameAudio(videoUrl);
    // The audio file will be saved as 'audio1.mp3'
    return null;
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Main function to run the process
async function main() {
  try {
    const transcriptText = await getTranscriptText('_Ki4bS4V2gQ');

    let knowledgeBase;
    if (transcriptText) {
      knowledgeBase = transcriptText;
    } else {
      // Using OpenAI's Whisper API for transcription
      console.time('Transcription');
      const resp = await openai.createTranscription(
        fs.createReadStream("audio1.mp3"),
        "whisper-1"
      );
      console.timeEnd('Transcription');

      console.log('Transcription:', resp.data.text);
      knowledgeBase = resp.data.text;
    }

    console.log('Knowledge base:', knowledgeBase);

    // Taking question as input
    const userQuestion = await question('Enter your question: ');

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Defining prompt for the required response
    const prompt = `You are an expert in finding answers or matching answers for the asked question from the Knowledge Base Given below.
                    Your task is to analyze the complete Knowledge Base and answer the questions asked.
                    The Knowledge Base is : ${knowledgeBase}
                    The Question is: ${userQuestion}
                    The Output Must be like Question:<Asked Question> And in new Line Answer: <Answer Generated>`;

    // Generate content
    const FirstResponse = await model.generateContent(prompt);
    console.log(FirstResponse.response.text());

    const nQuestions = await question('Enter the number of questions you want to generate: ');

    // Generate questions
    const questionsPrompt = `You are an expert in framing the number of questions asked.
                             Your task is to analyze the complete Knowledge Base and generate the number of questions asked.
                             The Knowledge Base is : ${knowledgeBase}
                             The Number of Questions need to be Generated is ${nQuestions}
                             The output must be 1.<Question1> 2.<Question2> 3.<Question3> upto specified number of questions`;

    const questionResponse = await model.generateContent(questionsPrompt);
    console.log(questionResponse.response.text());

    // Generate summary
    const summaryPrompt = `You are an expert in English Language
                           Now your task is to summarize the given content into 250 words and remove any grammatical mistakes.
                           The summary is :- ${knowledgeBase}
                           Generate the Important points in each line`;

    const summaryResponse = await model.generateContent(summaryPrompt);
    console.log(summaryResponse.response.text());

    // Generate MCQs
    const mcqsPrompt = `You are an expert in framing the number of MCQ questions asked.
                        Your task is to analyze the complete Knowledge Base and generate the number of questions asked.
                        The Knowledge Base is : ${knowledgeBase}
                        The Number of Questions need to be Generated is ${nQuestions}
                        The output must be 1.<Question1> a. opt1 b. op2 c. opt3 d. opt4  2.<Question2>a. opt1 b. op2 c. opt3 d. opt4 3.<Question3>a. opt1 b. op2 c. opt3 d. opt4 upto specified number of questions`;

    const mcqsResponse = await model.generateContent(mcqsPrompt);
    console.log(mcqsResponse.response.text());

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    rl.close();
  }
}

main();