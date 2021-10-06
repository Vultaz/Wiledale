

const FS = require('fs')

class Session {
	constructor(API,user_id,channel,session_timeout_limit) {
		this.API = API
		this.active = false
		this.profile = false
		this.timeout_limit = session_timeout_limit
		this.timeout = session_timeout_limit
		this.user_id = user_id
		this.channel = channel
	}
	
	Print(msg) {
		console.log("<USER> ("+this.user_id+") ",msg)
	}
	
	Save() {
		this.Print("saving profile.")
		try {
			FS.writeFile("./saves/"+this.user_id+"/save.json",JSON.stringify({
				'id': this.user_id,
				'profile': this.profile
			}),(err)=> {
				if (err) {
					this.Print("failed to save user profile.")
					this.Print(err)
					return false
				}
				FS.writeFile("./saves/"+this.user_id+"/save_backup.json",JSON.stringify({
					'id': this.user_id,
					'profile': this.profile
				}),(err)=> {
					if (err) {
						this.Print("failed to save backup profile.")
						this.Print(err)
					}
				})
				return true
			})
		} catch(err) {
			this.Print(err)
			return false
		}
	}
	
	Load() {
		this.Print("loading profile.")
		try {
			FS.readFile("./saves/"+this.user_id+"/save.json",(err,data)=> {
				if (err) {
					this.Print("failed to load user profile.")
					this.Print(err)
					this.API.emit('player_login_failed',this.user_id)
					return false
				}
				if (data.length === 0) {
					this.Print("Save file was empty. Loading backup.")
					FS.readFile("./saves/"+this.user_id+"/save_backup.json",(err,data)=> {
						if (err) {
							this.Print("failed to load backup user profile. Oooooooops.")
							this.Print(err)
							this.API.emit('player_login_failed',this.user_id)
							return false
						}
						if (data.length === 0) {
							this.Print("Backup save was empty. You're fucked.")
							this.API.emit('player_save_data_error',this.user_id)
							return false
						} else {
							this.Print("profile loaded.")
							if (this.channel) {
								this.active = true
							}
							this.profile = JSON.parse(data).profile
							this.API.emit('player_login',this.user_id)
							return true
						}
					})
				} else {
					this.Print("profile loaded.")
					if (this.channel) {
						this.active = true
					}
					this.profile = JSON.parse(data).profile
					this.API.emit('player_login',this.user_id)
					return true
				}
			})
		} catch(err) {
			this.Print(err)
			this.API.emit('player_login_failed',this.user_id)
			return false
		}
	}
	
	UserInput(content) {
		try {
			switch(content) {
				case "inactive":
					this.channel.send("You have been inactive for "+this.timeout+" seconds.")
					return true
				case "logout":
					this.Print("logout request received.")
					this.channel.send("Logging out.")
					this.timeout = 2
					return true
				case "talk":
					this.channel.send("No talking in the library. Sssh!")
					return true
				case "read":
					this.channel.send("You read some books. Boring stuff.")
					return true
				default:
					// this input not handled by session
					return false
			}
		} catch(err) {
			this.Print(err)
			return false
		}
	}
	
	ResetTimeout() {
		try {
			this.timeout = this.timeout_limit
		} catch(err) {
			this.Print(err)
		}
	}
}

module.exports = Session