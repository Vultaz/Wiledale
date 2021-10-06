

const Events = require('events')
const FS = require('fs')

class SessionManager extends Events {
	constructor(api) {
		super()
		
		this.API = api
		this.pruning_rate = 30
		this.pruning_timer = 0
		
		// Setup
		const {session_manager} = require('./config.json')
		this.session_timeout_limit = session_manager.session_timeout
		
		// Properties/Objects
		this.Sessions = {}
		
		/*	 API Events 	*/
		// Player login failed
		this.API.on('player_login_failed',(user_id)=> {
			this.Print(user_id+": failed to log in.")
			try {
				delete (this.Sessions[user_id])
			} catch(err) {
				this.Print(err)
			}
		})
		// Player game room created, attach to session
		this.API.on('game_room_created',(user_id,channel)=> {
			this.Print(user_id+": received game room. Attaching to session.")
			try {
				this.Sessions[user_id].channel = channel
				if (this.Sessions[user_id].profile) {
					this.Sessions[user_id].ready = true
				}
				channel.send("The Great Library\nThis message is temporary. You can currently type in 'inactive', 'logout', 'read' and 'talk' as commands. Your session will last for 10 minutes. It does not currently refresh. Do your worst jerks.")
			} catch(err) {
				this.Print(err)
				delete (this.Sessions[user_id])
			}
		})
		// Player game room failed creation, remove session
		.on('game_room_creation_failed',(user_id)=> {
			this.Print(user_id+": failed to receive game room. Removing session.")
			try {
				delete (this.Sessions[user_id])
			} catch(err) {
				this.Print(err)
			}
		})
		// User input, check if session input and submit to session
		this.API.on('input',(data)=> {
			if (data.type === "message" && data.message.author.id in this.Sessions) {
				this.Sessions[data.message.author.id].UserInput(data.message.content)
			}
		})
		
		// Start session tracker
		this.Print("Listening.")
		this.SessionTracker()
	}
	
	Print(msg) {
		console.log("<SESSMGR>",msg)
	}
	
	SessionTracker() {
		try {
			setTimeout(()=> {
				this.pruning_timer += 1
				if (this.pruning_timer > this.pruning_rate) {
					this.pruning_timer = 0
				}
				// Iterate over active sessions
				var active_sessions = []
				for (var s in this.Sessions) {
					this.Sessions[s].timeout -= 1
					// If session has reached 10 seconds or less on the timeout
					if (this.Sessions[s].timeout === 10) {
						this.Sessions[s].channel.send("Session timed out. Logging out in 10 seconds.")
					} else if (this.Sessions[s].timeout === 5) {
						this.Sessions[s].channel.send("Logging out in 5 seconds.")
					} else if (this.Sessions[s].timeout <= 0) {
						// Session has reached limit and will be removed
						this.Sessions[s].Save()
						this.Sessions[s].channel.permissionOverwrites.create(s,{
							SEND_MESSAGES: false,
							VIEW_CHANNEL: false,
							READ_MESSAGE_HISTORY: false
						})
						delete this.Sessions[s]
					} else {
						active_sessions.push(s)
					}
				}
				if (this.pruning_timer === 1) {
					this.API.emit('active_sessions',active_sessions)
				}
				// Reshedule
				this.SessionTracker()
			},1000)
		} catch(err) {
		}
	}
	
	CreateSession(user_id) {
		try {
			this.Print(user_id+" attempting to log in.")
			if (!(user_id in this.Sessions)) {
				const session = require('./session.js')
				this.Sessions[user_id] = new session(this.API,user_id,false,this.session_timeout_limit)
				this.Sessions[user_id].Load()
			}
		} catch(err) {
			this.Print(err)
			return false
		}
	}
}

module.exports = SessionManager