
const Events = require('events')

class Discord {
	constructor(API) {
		this.client = false
		this.ready = false
		this.API = new Events()
		
		this.channel_pruning_busy = false
		
		// Client setup
		const {Client,Intents} = require('discord.js')
		this.client = new Client({autoReconnect:true,intents:[
			Intents.FLAGS.GUILDS,
			Intents.FLAGS.GUILD_MEMBERS,
			Intents.FLAGS.GUILD_MESSAGES, 
			Intents.FLAGS.GUILD_MESSAGE_REACTIONS
		]})
		
		
		/* 	DISCORD CONNECTION EVENTS 	*/
		// Ready
		this.client.on('ready',()=> {
			this.Print("Client connected.")
			this.GetRequiredCachedMessages()
		})
		// Errors
		this.client.on('error',(err)=> {
			this.Print("!!!!!!!!!!!!!!!!!!!!\nClient error")
			this.Print(err)
			this.Print("!!!!!!!!!!!!!!!!!!!!")
		}).on('invalidated',()=> {
			this.Print("!!!!!!!!! Client invalidated.")
			this.ready = false
		}).on('guildUnavailable',(guild)=> {
			this.Print("!!!!!!!!! Guild unavailable.")
			this.ready = false
		})
		// User inputs
		this.client.on('messageCreate',async (msg)=> {
			// Log all messages sent in a game room to global log
			if (msg.channel.name.includes('game-room')) {
				const {guild_id,server_layout} = require('./config.json')
				const guild = await this.client.guilds.fetch(guild_id)
				const global_game_room_logging_channel = await guild.channels.cache.get(server_layout["Game Rooms"].channels["global-session-log"].id)
				global_game_room_logging_channel.send(msg.author.username+"("+msg.author.id+"): "+msg.content)
			}
			// Emit input event to API
			this.API.emit('input',{
				'type': "message",
				'message': {
					'id': msg.id,
					'author': {'id':msg.author.id,'name':msg.author.username},
					'content': msg.content,
					'channel': {'id':msg.channel.id,'name':msg.channel.name,'parent':msg.channel.parent,'object':msg.channel}
				}
			})
		}).on('messageReactionAdd',(reaction,user)=> {
			// Emit input event to API
			this.API.emit('input',{
				'type': "reaction",
				'reaction': {
					'author': {'id':user.id,'name':user.username},
					'emoji': reaction._emoji.id,
					'reaction': reaction
				},
				'message': {
					'id': reaction.message.id,
					'author': {'id':reaction.message.author.id,'name':reaction.message.author.username},
					'content': reaction.message.content,
					'channel': {'id':reaction.message.channelId,'name':false,'parent':false}
				}
			})
		})
		
		
		/*		DISCORD API CALLS		*/
		// Client Ready
		this.API.on('discord_ready',()=> {
			this.Print("Client ready.")
		})
		// A new player has joined, give join role
		this.API.on('player_joined',async (user_id)=> {
			try {
				this.Print("A new player has arrived: "+user_id)
				// Get user and join role
				const {guild_id,joined_role} = require('./config.json')
				const guild = await this.client.guilds.fetch(guild_id)
				const role = await guild.roles.cache.find(role=>role.name === joined_role)
				const user = await guild.members.cache.get(user_id)
				// Give user join role
				if (user && role) {
					this.Print("New user joined successfully.")
					user.roles.add(role)
					return true
				} else {
					this.Print("Failed to join new user: "+user_id)
					return false
				}
			} catch(err) {
				this.Print(err)
				return false
			}
		})
		// A player has attempted to log in, need to create channel
		this.API.on('player_login',async (user_id)=> {
			try {
				this.Print("A player is logging in:"+user_id)
				// Get channel
				const {guild_id,server_layout} = require('./config.json')
				const guild = await this.client.guilds.fetch(guild_id)
				const game_category = await guild.channels.cache.get(server_layout["Game Rooms"].id)
				// Build user channel
				const user_channel = await guild.channels.create("game-room-"+user_id,{
					'type':"GUILD_TEXT",
					'parent':game_category
				}).catch(error=> {
					this.Print("Failed to create user game room: "+user_id)
					this.Print(error)
					this.API.emit('game_room_creation_failed',user_id)
					return false
				})
				// Give user permissions to use channel
				if (user_channel) {
					user_channel.permissionOverwrites.create(user_id,{
						SEND_MESSAGES: true,
						VIEW_CHANNEL: true,
						READ_MESSAGE_HISTORY: true
					})
					this.API.emit('game_room_created',user_id,user_channel)
				} else {
					this.Print("Failed to set user permissions as room is not valid.")
					this.API.emit('game_room_creation_failed',user_id)
					return false
				}
			} catch(err) {
				this.Print(err)
				this.API.emit('game_room_creation_failed',user_id)
				return false
			}
		})
		// Inactive session room pruning - do this is room left over after logout
		this.API.on('active_sessions',async (active_sessions)=> {
			if (!this.channel_pruning_busy) {
				this.channel_pruning_busy = true
				try {
					const {guild_id} = require('./config.json')
					const guild = await this.client.guilds.fetch(guild_id)
					var to_remove = []
					await guild.channels.fetch().then((channels)=> {
						channels.each((channel) => {
							if (channel.name.includes("game-room-")) {
								if (!(active_sessions.includes(channel.name.split("-")[2]))) {
									this.Print(channel.name+" found inactive.")
									to_remove.push(channel)
								}
							}
						})
					})
					for (var s in to_remove) {
						try {
							await to_remove[s].delete()
						} catch(err) {
							this.Print("Could not delete "+s)
						}
					}
					this.channel_pruning_busy = false
				} catch(err) {
					this.channel_pruning_busy = false
					this.Print(err)
					return false
				}
			}
		})
	}
	
	Print(msg) {
		console.log("{DISCORD}",msg)
	}
	
	// Get cached messages required for listening to user reactions
	GetRequiredCachedMessages() {
		try {
			const GetCached = async ()=> {
				this.Print("Getting required cached messages.")
				
				// Guild
				const {guild_id,server_layout} = require('./config.json')
				const guild = await this.client.guilds.fetch(guild_id)
				
				// Welcome channel and message
				var channel = guild.channels.cache.get(server_layout.Hub.channels.welcome.id)
				var message = await channel.messages.fetch(server_layout.Hub.channels.welcome.message)
				
				// Login channel and message
				channel = guild.channels.cache.get(server_layout['Game Rooms'].channels['log-in'].id)
				message = await channel.messages.fetch(server_layout['Game Rooms'].channels['log-in'].message)
				
				this.Print("Required cached messages retrieved.")
				this.API.emit("discord_ready")
				return true
			}
			GetCached()
		} catch(err) {
			this.Print(err)
			return false
		}
	}
	
	Login() {
		try {
			const {token} = require('./config.json')
			this.client.login(token)
		} catch(err) {
			this.Print(err)
		}
	}
}

module.exports = Discord