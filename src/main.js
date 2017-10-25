// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import axios from 'axios'

const TOKEN = process.env.TOKEN

if (!TOKEN) throw new Error('TOKEN must be set')

axios.defaults.headers.authorization = TOKEN

if (process.env.NODE_ENV === 'development') {
  axios.defaults.baseURL = 'http://localhost:5000/api/v1'
} else if (process.env.NODE_ENV === 'production') {
  const API_URL = process.env.API_URL

  if (!API_URL) throw new Error('API_URL must be set')

  axios.defaults.baseURL = API_URL
}

Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  template: '<App/>',
  components: { App }
})
