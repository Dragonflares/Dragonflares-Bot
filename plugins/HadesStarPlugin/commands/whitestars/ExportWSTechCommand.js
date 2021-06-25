import { WhitestarsCommand } from './WhitestarsCommand';
import { Member, WhiteStar, Tech, Corp } from '../../database';
import { TechTree } from '../../techs';
import * as WsUtils from '../../utils/whiteStarsUtils.js';
import { confirmResultButtons } from '../../utils';
const Discord = require('discord.js');




export class ExportWSTechCommand extends WhitestarsCommand {
    constructor(plugin) {
        super(plugin, {
            name: 'exportwstech',
            aliases: ['ewstech'],
            description: "CSV Formatted WS Techs",
            usage: "&ewstech <wsrole>"
        });
    }

    async run(message, args) {
        let user = message.guild.member(message.author)
        let roles = message.mentions.roles.first()
        let member = await Member.findOne({ discordId: user.id.toString() }).populate('Corp').exec();
        if (!member)
            return message.channel.send("You aren't part of any Corporation. Join a Corporation first.")
        else {
            if (!roles) {
                let roleName = await confirmResultButtons(message, args.join(' '), message.guild.roles.cache.map(a => a.name))
                if (!roleName) return;
                roles = message.guild.roles.cache.find(r => r.name === roleName);
            }

            if (member.Corp.corpId === message.guild.id.toString())
                return this.summaryAll(message, roles)
            else
                return message.channel.send("You aren't on your Corporation's server!")
        }
    }



    summaryAll = async (message, role) => {
        message.delete({ timeout: 1 });    //Delete User message
        const ws = await WhiteStar.findOne({ wsrole: role.id }).populate('author').populate('members').populate('members/techs').exec()
        if (!ws) return;
        this.summaryMessage(message, ws, "Weapons And Shields")
        this.summaryMessage(message, ws, "Support")
        this.summaryMessage(message, ws, "Mining")
        this.summaryMessage(message, ws, "Economics")
    }

    summaryMessage = async (message, ws, cat) => {
        let techsCategories = new Map([
            ["Weapons And Shields", ['Battery', 'Laser', 'MassBattery', 'DualLaser', 'Barrage', 'DeltaShield', 'OmegaShield', 'BlastShield', 'AreaShield']],
            ["Support", ['EMP', 'Teleport', 'RemoteRepair', 'TimeWarp', 'Unity',
                'Fortify', 'AlphaRocket', 'Suppress', 'Destiny', 'Barrier',
                'DeltaRocket', 'Leap', 'OmegaRocket', 'RemoteBomb']],
            ["Mining", ['MiningBoost', 'Enrich', 'RemoteMining', 'MiningUnity', 'Crunch']],
            ["Economics", ['Dispatch', 'RelicDrone']]
        ])
        //Create Message
        /* let summaryEmbed = new Discord.MessageEmbed()
             .setTitle(`Export of whitestar members ${cat} techs:`)
             .setThumbnail("https://i.imgur.com/fNtJDNz.png")
             .addField("Group:", `<@&${ws.wsrole}>`, true)
         */
        let mesText = techsCategories.get(cat).join(',')
        mesText = mesText + '\n'

        //let asyncTech = new Map()
        var memberTechs = {};
        await Promise.all(Array.from(ws.members).map(async member => {
            await Promise.all(Array.from(techsCategories.get(cat)).map(async t => {
                let tech = await this.GetModule(member, t)

                if (!(member in memberTechs)) memberTechs[member] = new Map()
                if (tech)
                    memberTechs[member].set(t, tech.level)
                else
                    memberTechs[member].set(t, '0')
            }))
        }))

        ws.members.forEach(async member => {
            let line = []
            line.push(member.name)
            techsCategories.get(cat).forEach(async t => {
                line.push(memberTechs[member].get(t))
            })

            mesText = mesText + line.join(',') + '\n'
        })

        let finalTxt = `__${cat}__\n\`\`\`${mesText}\n\`\`\``
        return message.channel.send(finalTxt)
    }
    async GetModule(member, techName) {
        let techFound;
        let techs = await Tech.find({ _id: Array.from(member.techs) })

        techs.map(t => {
            if (t.name == techName) techFound = t;
        })
        return techFound
    }
}