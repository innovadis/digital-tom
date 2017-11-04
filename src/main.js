// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import axios from 'axios'

Vue.config.productionTip = false

if (process.env.NODE_ENV === 'development') {
  axios.defaults.baseURL = 'http://localhost:5000'
} else if (process.env.NODE_ENV === 'production') {
  const API_URL = process.env.API_URL

  if (!API_URL) throw new Error('API_URL must be set')

  axios.defaults.baseURL = API_URL
}

(async () => {
  let TOKEN = window.localStorage.getItem('TOKEN')

  if (!TOKEN) {
    const password = window.prompt('Enter your password')

    const res = await axios.post('/auth/login', {
      email: 'info@digitalereceptionist.nl',
      password
    })

    TOKEN = res.data.token

    window.localStorage.setItem('TOKEN', TOKEN)
  }

  axios.defaults.headers.authorization = TOKEN

  /* eslint-disable no-new */
  new Vue({
    el: '#app',
    router,
    template: '<App/>',
    components: { App }
  })
})()
