

class Application {
	constructor(api) {
		this.fs = require('fs')
		this.API = api
		this.SessionManager = new (require('./session_manager'))(api)
		
		/*	 API Events 	*/
		this.API.on('input',(input)=> {
			const {server_layout} = require('./config.json')
			// Check if user is joining the server
			if (input.type === "reaction" && input.reaction.emoji === server_layout.Hub.channels.welcome.emoji && input.message.channel.id === server_layout.Hub.channels.welcome.id) {
				this.CreatePlayer(input.reaction.author.id)
			}
			// Check if user is logging in to the game
			if (input.type === "reaction" && input.reaction.emoji === server_layout["Game Rooms"].channels["log-in"].emoji && input.message.channel.id === server_layout["Game Rooms"].channels["log-in"].id) {
				this.SessionManager.CreateSession(input.reaction.author.id)
				input.reaction.reaction.users.remove(input.reaction.author.id)
			}
		})
	}
	
	Print(msg) {
		console.log("[APPLICATION]",msg)
	}
	
	CreatePlayer(user_id) {
		this.Print("Creating new player "+user_id)
		try {
			this.fs.mkdir("./saves/"+user_id,(err)=> {
				if (err) {
					this.Print(user_id+": failed to create user save path.")
					this.Print(err)
					return false
				}
				this.Print(user_id+": user save path created.")
				this.fs.writeFile("./saves/"+user_id+"/save.json",JSON.stringify({
					'id': user_id,
					'profile': {
						'strength': 3,
						'agility': 3,
						'intellect': 3,
						'stamina': 3
					}
				}),(err)=> {
					if (err) {
						this.Print(user_id+": failed to create user save file.")
						this.Print(err)
						this.fs.rmdir("./saves/"+user_id,(err)=> {
							if (err) {
								this.Print(user_id+": failed to remove user save directory.")
								this.Print("You will need to remove this manually.")
								this.Print(err)
							}
						})
						return false
					}
					this.Print(user_id+": created save file")
					this.API.emit("player_joined",user_id)
				})
			})
		} catch(err) {
			this.Print(err)
		}
	}
}

module.exports = Application