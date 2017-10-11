<template lang="pug">
.flex.flex-justify-center.flex-align-center.full-height.flex-column
  .header
    h1.brand Innovadis
    h3.title Digitale Receptionist

  .wave-container
    transition(name='fade', mode='in-out')
      wave(:animate='animateSiri', v-show='animateSiri')

  transition(name='fade', mode='in-out')
    .message(v-if='currentMessage') {{ currentMessage }}

  .speech
    p(v-for='s in speechHistory') {{ s }}
</template>

<script>
import axios from 'axios'
import Wave from './Wave'

const RESET_TIMEOUT = 30 * 1000

const KEYWORDS = {
  package: ['pakket', 'pakketje', 'zending', 'brief', 'post', 'pakje', 'levering', 'brengen'],
  appointment: ['afspraak', 'meeting', 'vergadering', 'bijeenkomst', 'presentatie', 'gesprek'] // TODO test grammar
}

const NAMES = [
  {
    speechRecognize: 'jurgen',
    display: 'Jurgen van Kreij',
    key: 'jurgen'
  },
  {
    speechRecognize: 'christiaan',
    display: 'Christiaan Maks',
    key: 'christiaan'
  },
  {
    speechRecognize: 'martijn',
    display: 'Martijn van Tongeren',
    key: 'martijn'
  }
]

const STATES = {
  IDLE: {
    key: 'IDLE',
    message: null
  },

  WAITING: {
    key: 'WAITING',
    message: 'Hallo, wat kan ik voor je doen?',
    audioPath: '/static/voice/christiaan_hallo.m4a'
  },

  APPOINTMENT_ENTRY: {
    key: 'APPOINTMENT_ENTRY',
    message: 'Met wie heb je een afspraak?',
    audioPath: '/static/voice/christiaan_afspraakmetwie.m4a'
  },

  APPOINTMENT_CONFIRMED: {
    key: 'APPOINTMENT_CONFIRMED',
    message: 'Top, ik bel $0 op',
    audioPath: '/static/voice/christiaan_ikbelop.m4a'
  },

  PACKAGE_ENTRY: {
    key: 'PACKAGE_ENTRY',
    message: 'Wat leuk! Heb je iemand nodig, voor handtekening of hulp?',
    validResponses: {
      yes: ['ja', 'graag'],
      no: ['nee']
    }
  },

  PACKAGE_CONFIRMED_NOHELP: {
    key: 'PACKAGE_CONFIRMED',
    message: `Je mag het achterlaten op de balie, dan ga ik Innovadis een berichtje sturen.

    Bedankt & tot ziens!`
  },

  PACKAGE_CONFIRMED_HELP: {
    key: 'PACKAGE_CONFIRMED_HELP',
    message: 'Ik ga iemand voor je bellen'
  },

  CALLING_INPROGRESS: {
    key: 'CALLING_INPROGRESS',
    message: 'Telefoon gaat over...'
  },

  CALLING_ANSWERED: {
    key: 'CALLING_ANSWERED',
    message: 'Er komt iemand aan!'
  }
}

export default {
  components: {
    Wave
  },

  data() {
    return {
      speechHistory: [],
      speech: [],
      recognition: null,
      callId: null,
      animateSiri: false,
      currentMessage: null,
      currentState: null,
      lastRecognizedName: null
    }
  },

  methods: {
    async log(type, message) {
      if (type === 'event') {
        await axios.post('http://localhost:3000/api/v1/log/event', {
          message
        })
      } else if (type === 'speech') {
        await axios.post('http://localhost:3000/api/v1/log/speech', {
          speech: message
        })
      } else {
        throw new Error('nyi')
      }
    },

    init() {
      this.recognition = new webkitSpeechRecognition() // eslint-disable-line
      this.recognition.continuous = true
      this.recognition.lang = 'nl-NL'
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1

      this.recognition.onresult = (event) => {
        this.speech = new Array(...event.results).map(x => x[0].transcript.toLowerCase().trim())

        this.speechHistory = this.speech// this.speechHistory.concat(this.speech)

        this.log('speech', this.speech)

        this.processSpeech()
      }

      this.recognition.onend = () => {
        this.animateSiri = false
      }

      this.recognition.onspeechstart = (event) => {
        this.setState(STATES.WAITING)
      }
    },

    playAudio(path) {
      this.animateSiri = true

      const audio = new Audio(path)

      audio.play()

      audio.onended = () => {
        this.animateSiri = false
      }
    },

    setState(state, replacements) {
      this.currentState = state

      this.log('event', 'state change: ' + state.key)

      let message = state.message

      if (replacements) {
        for (let i = 0; i < replacements.length; i++) {
          if (message.includes('$' + i)) {
            message = message.replace('$' + i, replacements[i])
          }
        }
      }

      this.updateMessage(message)

      if (state.audioPath) {
        this.playAudio(state.audioPath)
      }
    },

    updateMessage(message) {
      if (this.currentMessage !== message) {
        this.currentMessage = null

        setTimeout(() => {
          this.currentMessage = message
        }, 0)
      }
    },

    listen() {
      this.recognition.start()

      this.log('event', 'listen started')
    },

    stop() {
      this.recognition.abort()

      this.log('event', 'listen stopped')
    },

    delayedReset() {
      this.log('event', 'delayed reset')

      setTimeout(() => {
        this.speech = []
        this.speechHistory = []
        this.lastRecognizedName = null

        this.setState(STATES.IDLE)

        this.listen()
      }, RESET_TIMEOUT)
    },

    processSpeech() {
      switch (this.currentState.key) {
        case STATES.IDLE.key: {
          // responds to any sound from init()

          break
        }

        case STATES.WAITING.key: {
          // check for appointment keyword
          if (this.speech.some(x => KEYWORDS.appointment.some(keyword => x.indexOf(keyword) !== -1))) {
            this.setState(STATES.APPOINTMENT_ENTRY)
          }

          // check for package keyword
          if (this.speech.some(x => KEYWORDS.package.some(keyword => x.indexOf(keyword) !== -1))) {
            this.setState(STATES.PACKAGE_ENTRY)
          }
          break
        }

        case STATES.APPOINTMENT_ENTRY.key: {
          // check for supported names
          const nameIndex = NAMES.findIndex(name => this.speech.some(s => s.indexOf(name.speechRecognize) !== -1))

          if (nameIndex >= 0) {
            this.lastRecognizedName = NAMES[nameIndex]

            this.setState(STATES.APPOINTMENT_CONFIRMED, [this.lastRecognizedName.display])

            this.stop()

            this.call()

            this.delayedReset() // TODO should be after call complete confirmation
          }

          break
        }

        case STATES.APPOINTMENT_CONFIRMED.key: {
          // doesnt respond to anything

          break
        }

        case STATES.PACKAGE_ENTRY.key: {
          if (this.speech.some(x => STATES.PACKAGE_ENTRY.validResponses.yes.some(keyword => x.indexOf(keyword) !== -1))) { // check if user said yes
            this.setState(STATES.PACKAGE_CONFIRMED_HELP)

            this.stop()

            this.delayedReset()
          } else if (this.speech.some(x => STATES.PACKAGE_ENTRY.validResponses.no.some(keyword => x.indexOf(keyword) !== -1))) { // check if user said no
            this.setState(STATES.PACKAGE_CONFIRMED_NOHELP)

            this.stop()

            this.call()

            this.delayedReset()
          }

          break
        }

        case STATES.PACKAGE_CONFIRMED_HELP.key: {
          // doesnt respond to anything

          break
        }

        case STATES.PACKAGE_CONFIRMED_NOHELP.key: {
          // doesnt respond to anything

          break
        }

        case STATES.CALLING_INPROGRESS.key: {
          // doesnt respond to anything

          break
        }

        case STATES.CALLING_ANSWERED.key: {
          // doesnt respond to anything

          break
        }

        default:
          throw new Error('nyi')
      }
    },

    async call() {
      const res = await axios.post('http://localhost:3000/api/v1/phone/call', {
        name: this.lastRecognizedName.key
      })

      // this.callId = res.data.callId

      setTimeout(() => {
        this.setState(STATES.CALLING_INPROGRESS) // TODO cancel this on call success
      }, 5000)

      setTimeout(() => {
        this.setState(STATES.CALLING_ANSWERED) // TEMP hack because there is no feedback yet
      }, 15000)

      setTimeout(() => {
        this.checkCallProgress()
      }, 1000)
    },

    async checkCallProgress() {
      return // TODO must be through webhook
      const res = await axios.get('http://localhost:3000/api/call/' + this.callId)

      console.log(res)

      setTimeout(() => { // TODO replace with websocket
        this.checkCallProgress()
      }, 1000)
    }
  },

  mounted() {
    this.setState(STATES.IDLE)

    this.init()

    this.listen()
  }
}
</script>

<style lang="scss" scoped>
@import 'src/styles/variables';

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute;
  top: 0;


  .brand {
    color: white;
    font-size: 80px;
    margin: 40px 0 0 0;

    &:after {
      content: '.';
      color: $inno-yellow;
    }
  }

  .title {
    color: white;
    font-size: 32px;
  }
}

.message {
  color: white;
  white-space: pre-line;
  text-align: center;
  max-width: 75%;
  font-size: 18px;
}

.speech {
  position: absolute;
  bottom: 0;

  &:after {
    content: '';
    height: 300px;
    width: 100%;
    background: linear-gradient(to bottom, $inno-blue-dark 30%, transparent 70%);
    position: absolute;
    bottom: 0;
    left: 0;
  }

  p {
    color: white;
    font-size: 16px;
    text-align: center;
    transition: all 0.2s ease-in-out;
    height: 10px;

    @for $i from 1 through 100 {
      &:nth-last-child(n+#{$i}) {
        opacity: 1 - 0.2 * $i;
        transform-origin: 50% 100%;
        transform: perspective(100px) rotateX(25deg) scale(0.8);
      }

      &:last-child {
        opacity: 1;
        transform: none;
        font-size: 20px;
        line-height: 14px;
      }
    }
  }
}

.wave-container {
  display: flex;
  justify-content: center;
  height: 60px;
}
</style>
