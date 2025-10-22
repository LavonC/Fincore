"""
Voice Assistant Backend using Gemini AI
Handles speech-to-text, AI conversation, and text-to-speech
Uses free-tier services: Whisper (OpenAI free) or browser-based recognition + Gemini AI + gTTS (free)
Compatible with Python 3.13
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from dotenv import load_dotenv
from gtts import gTTS
import google.generativeai as genai
from datetime import datetime
import traceback
import tempfile
import json
import subprocess
import time
import base64

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('models/gemini-2.5-flash')
    print("✅ Gemini API configured for voice assistant")
else:
    model = None
    print("⚠️  WARNING: GEMINI_API_KEY not found!")

def transcribe_audio_with_gemini(audio_file_path):
    """
    Transcribe audio using Gemini's built-in audio support (FREE!)
    Gemini can process audio directly without separate transcription
    """
    try:
        # Check if model is available
        if not model:
            print(f"⚠️ Gemini model not initialized")
            return None
        
        print(f"🎤 Transcribing audio with Gemini...")
        print(f"📁 Audio file: {audio_file_path}")
        print(f"📊 File size: {os.path.getsize(audio_file_path)} bytes")
        
        # Use inline data method (works with all API versions)
        print(f"📤 Converting audio to base64...")
        
        with open(audio_file_path, 'rb') as f:
            audio_data = base64.b64encode(f.read()).decode('utf-8')
        
        print(f"✅ Audio encoded ({len(audio_data)} chars)")
        
        # Create inline data format
        audio_part = {
            "inline_data": {
                "mime_type": "audio/m4a",
                "data": audio_data
            }
        }
        
        prompt = "Listen to this audio carefully and transcribe exactly what is being said. Return ONLY the transcription text, nothing else. Do not add any comments or explanations."
        
        print(f"🎯 Sending to Gemini for transcription...")
        response = model.generate_content([prompt, audio_part])
        
        transcription = response.text.strip()
        print(f"✅ Gemini transcription: {transcription}")
        
        return transcription
            
    except Exception as e:
        print(f"❌ Gemini audio transcription failed: {e}")
        traceback.print_exc()
        return None

def transcribe_audio_with_vosk(audio_file_path):
    """
    Transcribe audio using Vosk (FREE, offline, no API key needed)
    """
    try:
        from vosk import Model, KaldiRecognizer
        import wave
        import json
        
        print(f"🎤 Transcribing audio with Vosk (offline)...")
        
        # Load Vosk model (need to download once)
        model_path = "vosk-model-small-en-us-0.15"
        if not os.path.exists(model_path):
            print(f"⚠️ Vosk model not found. Please download from https://alphacephei.com/vosk/models")
            return None
        
        model = Model(model_path)
        
        # Open audio file
        wf = wave.open(audio_file_path, "rb")
        rec = KaldiRecognizer(model, wf.getframerate())
        rec.SetWords(True)
        
        # Process audio
        text_parts = []
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if 'text' in result:
                    text_parts.append(result['text'])
        
        # Get final result
        final_result = json.loads(rec.FinalResult())
        if 'text' in final_result:
            text_parts.append(final_result['text'])
        
        transcription = ' '.join(text_parts).strip()
        print(f"✅ Vosk transcription: {transcription}")
        return transcription
        
    except ImportError:
        print(f"⚠️ Vosk not installed. Install with: pip install vosk")
        return None
    except Exception as e:
        print(f"❌ Vosk transcription failed: {e}")
        return None

def transcribe_audio_with_assemblyai(audio_file_path):
    """
    Transcribe audio using AssemblyAI (FREE tier: 5 hours/month)
    Requires ASSEMBLYAI_API_KEY in .env
    """
    try:
        import assemblyai as aai
        
        api_key = os.getenv('ASSEMBLYAI_API_KEY', '')
        if not api_key:
            print(f"⚠️ ASSEMBLYAI_API_KEY not found in .env")
            return None
        
        print(f"🎤 Transcribing audio with AssemblyAI...")
        
        aai.settings.api_key = api_key
        transcriber = aai.Transcriber()
        
        transcript = transcriber.transcribe(audio_file_path)
        
        if transcript.status == aai.TranscriptStatus.error:
            print(f"❌ AssemblyAI error: {transcript.error}")
            return None
        
        transcription = transcript.text.strip()
        print(f"✅ AssemblyAI transcription: {transcription}")
        return transcription
        
    except ImportError:
        print(f"⚠️ AssemblyAI not installed. Install with: pip install assemblyai")
        return None
    except Exception as e:
        print(f"❌ AssemblyAI transcription failed: {e}")
        return None

def transcribe_audio_simple(audio_file_path):
    """
    Try multiple transcription methods in order of preference:
    1. Gemini (FREE, uses existing API key)
    2. Vosk (FREE, offline, no API key)
    3. AssemblyAI (FREE tier, 5 hours/month)
    """
    print(f"🔄 Starting transcription attempts...")
    
    # Try Gemini first (best option - already have API key)
    print(f"📍 Method 1: Trying Gemini audio transcription...")
    result = transcribe_audio_with_gemini(audio_file_path)
    if result:
        print(f"✅ Gemini transcription successful!")
        return result
    print(f"⚠️ Gemini transcription failed, trying next method...")
    
    # Try Vosk (offline, no API key needed)
    print(f"📍 Method 2: Trying Vosk offline transcription...")
    result = transcribe_audio_with_vosk(audio_file_path)
    if result:
        print(f"✅ Vosk transcription successful!")
        return result
    print(f"⚠️ Vosk transcription failed, trying next method...")
    
    # Try AssemblyAI (requires API key but has free tier)
    print(f"📍 Method 3: Trying AssemblyAI transcription...")
    result = transcribe_audio_with_assemblyai(audio_file_path)
    if result:
        print(f"✅ AssemblyAI transcription successful!")
        return result
    print(f"⚠️ AssemblyAI transcription failed")
    
    print(f"❌ All transcription methods failed")
    print(f"   Please use text input mode or add API keys")
    return None

def transcribe_audio_with_whisper(audio_file_path):
    """
    Convert audio file to text using Whisper CLI (free, local)
    Falls back to returning a placeholder if Whisper not available
    """
    try:
        # Try using whisper CLI if installed
        result = subprocess.run(
            ['whisper', audio_file_path, '--model', 'tiny', '--output_format', 'txt'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Read the generated txt file
            txt_file = audio_file_path.replace('.m4a', '.txt').replace('.wav', '.txt')
            if os.path.exists(txt_file):
                with open(txt_file, 'r') as f:
                    text = f.read().strip()
                os.remove(txt_file)  # Cleanup
                print(f"📝 Whisper transcribed: {text}")
                return text
        
        print("⚠️ Whisper not available, using fallback")
        return None
        
    except FileNotFoundError:
        print("⚠️ Whisper CLI not installed")
        return None
    except Exception as e:
        print(f"❌ Whisper error: {e}")
        return None

def get_financial_context(user_id):
    """
    Get user's financial summary for context-aware responses
    This would connect to your main database
    """
    # TODO: Connect to actual database
    # For now, return placeholder
    return {
        'has_account': False,
        'balance': 0,
        'recent_spending': 0,
    }

def generate_ai_response(user_message, user_id=None):
    """
    Generate conversational AI response using Gemini
    """
    try:
        if not model:
            return "I'm sorry, the voice assistant is currently unavailable. Please try again later."
        
        # Get financial context if user_id provided
        context_info = ""
        if user_id:
            financial_context = get_financial_context(user_id)
            if financial_context['has_account']:
                context_info = f"\n\nUser's Financial Context:\n- Current Balance: ₹{financial_context['balance']:,.2f}\n- Recent Spending: ₹{financial_context['recent_spending']:,.2f}"
        
        # Build conversational prompt
        prompt = f"""You are a helpful and friendly financial assistant named FinAI. 
You help users understand their finances, provide advice, and answer money-related questions.

Guidelines:
- Be conversational, warm, and encouraging
- Give specific, actionable advice
- Keep responses concise (2-4 sentences for voice)
- Use simple language, avoid jargon
- If you don't have specific data, give general financial advice
- Always be supportive and never judgmental
{context_info}

User's question: "{user_message}"

Provide a helpful, conversational response:"""

        # Generate response
        response = model.generate_content(
            prompt,
            generation_config={
                'temperature': 0.8,
                'max_output_tokens': 500,  # Increased from 200 to avoid truncation
                'candidate_count': 1,
            }
        )
        
        # Debug: Print response structure
        print(f"📊 Response object: {type(response)}")
        print(f"📊 Has candidates: {hasattr(response, 'candidates') and len(response.candidates) > 0}")
        
        # Check for safety ratings or blocked content
        if hasattr(response, 'prompt_feedback'):
            print(f"📊 Prompt feedback: {response.prompt_feedback}")
        
        # Handle response safely
        ai_response = None
        try:
            ai_response = response.text.strip()
            print(f"✅ Got response using response.text")
        except (ValueError, AttributeError) as e:
            print(f"⚠️  response.text failed: {e}")
            # If response.text fails, use the parts accessor
            try:
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    print(f"📊 Candidate finish_reason: {candidate.finish_reason if hasattr(candidate, 'finish_reason') else 'N/A'}")
                    
                    if candidate.content and hasattr(candidate.content, 'parts'):
                        parts_text = []
                        for i, part in enumerate(candidate.content.parts):
                            if hasattr(part, 'text') and part.text:
                                parts_text.append(part.text)
                        
                        if parts_text:
                            ai_response = ''.join(parts_text).strip()
                            print(f"✅ Got response from parts")
                        else:
                            print(f"⚠️  Parts array is empty - likely hit token limit")
                    else:
                        print(f"⚠️  Candidate content has no parts")
            except Exception as parts_error:
                print(f"❌ Parts extraction failed: {parts_error}")
                traceback.print_exc()
        
        if not ai_response or len(ai_response) == 0:
            print(f"⚠️  No response generated, using fallback")
            ai_response = "I can help you with financial questions! Try asking about savings, budgeting, or spending tips."
        
        print(f"🤖 AI Response: {ai_response[:100]}...")
        
        return ai_response
        
    except Exception as e:
        print(f"❌ Error generating AI response: {e}")
        traceback.print_exc()
        return "I'm having trouble processing your request. Could you try asking again?"

def text_to_speech(text, output_path):
    """
    Convert text to speech using gTTS (free)
    """
    try:
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(output_path)
        print(f"🔊 Generated speech audio: {output_path}")
        return True
    except Exception as e:
        print(f"❌ Text-to-speech error: {e}")
        traceback.print_exc()
        return False

@app.route('/voice-assistant/process', methods=['POST'])
def process_voice_input():
    """
    Main endpoint: Process voice input and return AI response with audio
    Accepts either audio file OR pre-transcribed text
    """
    try:
        transcription = None
        user_id = request.form.get('user_id')  # Optional
        
        # Check if text is provided directly (from browser speech recognition)
        if 'transcription' in request.form:
            transcription = request.form.get('transcription')
            print(f"📝 Received transcription: {transcription}")
        
        # Otherwise, try to process audio file
        elif 'audio' in request.files:
            audio_file = request.files['audio']
            
            # Save uploaded audio temporarily
            temp_audio_path = tempfile.mktemp(suffix='.m4a')
            audio_file.save(temp_audio_path)
            
            print(f"📥 Received audio file: {temp_audio_path}")
            print(f"📊 File size: {os.path.getsize(temp_audio_path)} bytes")
            
            # Try transcription with multiple methods
            transcription = transcribe_audio_simple(temp_audio_path)
            
            # If transcription failed, suggest using text mode
            if not transcription:
                # Cleanup audio file
                if os.path.exists(temp_audio_path):
                    os.remove(temp_audio_path)
                    
                return jsonify({
                    'success': False,
                    'error': 'Audio transcription not available. Please switch to text input mode (tap the toggle button).',
                    'suggestion': 'Use text input for now'
                }), 400
            
            # Cleanup audio file
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
        
        else:
            return jsonify({
                'success': False,
                'error': 'No audio file or transcription provided'
            }), 400
        
        if not transcription:
            return jsonify({
                'success': False,
                'error': 'Could not transcribe audio. Please try again or check your microphone.'
            }), 400
        
        # Step 2: Generate AI response
        ai_response = generate_ai_response(transcription, user_id)
        
        # Step 3: Convert response to speech
        response_audio_path = tempfile.mktemp(suffix='.mp3')
        tts_success = text_to_speech(ai_response, response_audio_path)
        
        # Return response
        response_data = {
            'success': True,
            'transcription': transcription,
            'response': ai_response,
            'audioUrl': f"http://192.168.1.3:8002/voice-assistant/audio/{os.path.basename(response_audio_path)}" if tts_success else None,
            'timestamp': datetime.now().isoformat()
        }
        
        # Store audio path for later retrieval
        if tts_success:
            # In production, store in database or cloud storage
            # For now, keep in temp with identifier
            global audio_files_cache
            if 'audio_files_cache' not in globals():
                audio_files_cache = {}
            audio_files_cache[os.path.basename(response_audio_path)] = response_audio_path
        
        print(f"✅ Voice processing complete")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Error processing voice input: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/voice-assistant/audio/<filename>', methods=['GET'])
def get_audio_file(filename):
    """
    Serve generated audio file
    """
    try:
        if 'audio_files_cache' in globals() and filename in audio_files_cache:
            file_path = audio_files_cache[filename]
            if os.path.exists(file_path):
                return send_file(file_path, mimetype='audio/mpeg')
        
        return jsonify({'error': 'Audio file not found'}), 404
    except Exception as e:
        print(f"❌ Error serving audio: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/voice-assistant/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'gemini_configured': model is not None,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🎤 Voice Assistant Backend Starting...")
    print("=" * 60)
    print("✅ Services:")
    print("  - Speech-to-Text: Google Speech Recognition (FREE)")
    print("  - AI Model: Gemini 2.5 Flash")
    print("  - Text-to-Speech: gTTS (FREE)")
    print("=" * 60)
    print("\n🚀 Server running on http://localhost:8002")
    print("📊 Endpoints:")
    print("  - POST /voice-assistant/process")
    print("  - GET  /voice-assistant/audio/<filename>")
    print("  - GET  /voice-assistant/health")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=8002, debug=True)
