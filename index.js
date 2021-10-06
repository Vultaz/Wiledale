

const Discord = require('./discord.js')
const Application = require('./application.js')

var discord = new Discord()
var app = new Application(discord.API)

discord.Login()
