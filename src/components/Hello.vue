<template lang="pug">
.flex.flex-justify-center.flex-align-center.full-height
  transition(name='fade', mode='in-out')
    h1.message(v-if='tomMessage') {{ tomMessage }}
  //- button(@click='stop') stop
  .speech
    p(v-for='s in speech') {{ s }}
</template>

<script>
import axios from 'axios'

const TOM_MESSAGES = {
  hello: 'Hoi! Wat brengt je bij Innovadis?',
  appointment: 'Je hebt een afspraak? Met wie?',
  appointmentConfirmed: 'Top, ik bel $0 op',
  callingInProgress: 'Hij gaat over...',
  callingAnswered: 'Nou, hij komt naar beneden'
}

const KEYWORDS = {
  appointment: 'afspraak'
}

const NAMES = [
  {
    speechRecognize: 'jurgen',
    display: 'Jurgen van Kreij'
  }
]

export default {
  data() {
    return {
      tomMessage: TOM_MESSAGES.hello,
      speech: [],
      recognition: null,
      callId: null
    }
  },

  methods: {
    init() {
      this.recognition = new webkitSpeechRecognition() // eslint-disable-line
      this.recognition.continuous = true
      this.recognition.lang = 'nl-NL'
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1

      this.recognition.onresult = (event) => {
        this.speech = new Array(...event.results).map(x => x[0].transcript.toLowerCase().trim())

        this.process()
      }
    },

    updateMessage(message) {
      if (this.tomMessage !== message) {
        this.tomMessage = null

        setTimeout(() => {
          this.tomMessage = message
        }, 0)
      }
    },

    process() {
      if (this.speech.some(x => x.indexOf(KEYWORDS.appointment) !== -1)) {
        this.updateMessage(TOM_MESSAGES.appointment)

        const nameIndex = NAMES.findIndex(name => this.speech.some(s => s.indexOf(name.speechRecognize) !== -1))

        if (nameIndex >= 0) {
          const recognizedName = NAMES[nameIndex]

          this.updateMessage(TOM_MESSAGES.appointmentConfirmed.replace('$0', recognizedName.display))

          this.stop()

          this.call()
        }
      }
    },

    listen() {
      this.recognition.start()
    },

    stop() {
      this.recognition.stop()
    },

    async call() {
      const res = await axios.post('http://localhost:5000/api/v1/phone/call')

      this.callId = res.data.callId

      setTimeout(() => {
        this.updateMessage(TOM_MESSAGES.callingInProgress) // TODO cancel this on call success
      }, 5000)

      setTimeout(() => {
        this.updateMessage(TOM_MESSAGES.callingAnswered) // TEMP hack because there is no feedback yet
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
    this.init()

    this.listen()
  }
}
</script>

<style lang="scss" scoped>
@import 'src/styles/variables';

.message {
  color: white;
}

.speech {
  position: absolute;
  bottom: 0;

  p {
    color: white;
    font-size: 12px;
  }
}
</style>
