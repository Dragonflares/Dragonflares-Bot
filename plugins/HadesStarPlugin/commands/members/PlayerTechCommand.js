import { MemberCommand } from './MemberCommand';
import { Member, Tech, Corp } from '../../database';
import { MessageEmbed } from 'discord.js';
import { TechTree } from '../../techs';
import { confirmTech } from '../../utils';
import { findBestMatch } from 'string-similarity';
import { confirmResult } from '../../utils';

export class PlayerTechCommand extends MemberCommand {
    constructor(plugin) {
        super(plugin, {
            name: 'playertech',
            aliases: ['ptech'],
            description: "Shows the techs of a certain player in your corp.",
            usage: "&playertech (player)"
        });
    }

    async run(message, args) {
        let dMember = message.author;
        let dTarget = message.mentions.users.first() || message.author;
        let category = null
        let target;
        let member = await Member.findOne({ discordId: dMember.id.toString() }).populate("Corp").exec();
        if (!member)
            return message.channel.send("You aren't part of any Corporations, so you cannot request this information from anyone.")

        if (!message.mentions.users.first()) {
            let playername;
            const techorMemberName = args.join('');
            let corp = await Corp.findOne({ corpId: message.guild.id.toString() }).populate('members').exec();
            let members = Array.from(corp.members).map(t => t.name)
            let joined = members.concat(Array.from(TechTree.categories.keys()))
            const rate = findBestMatch(techorMemberName, joined);

            if (!await confirmResult(message, techorMemberName, rate.bestMatch.target))
            return;

            if (Array.from(members).includes(rate.bestMatch.target)) {
                playername = rate.bestMatch.target
            } else {
                playername = member.name
                category = rate.bestMatch.target
            }

            if (member.Corp.corpId != message.guild.id.toString())
                return message.channel.send("You can't see a Member tech outside of your Corporation!");

            target = await Member.findOne({ name: playername }).populate("Corp").populate('techs').exec();

        } else {
            category = args[0]

            if (member.Corp.corpId != message.guild.id.toString())
                return message.channel.send("You can't see a Member tech outside of your Corporation!");

            target = await Member.findOne({ discordId: dTarget.id.toString() }).populate("Corp").populate('techs').exec();
        }

        if (!target)
            return message.channel.send("This Member was never part of a Corporation! He must join one to have a tech tracker!");
        return this.techInformation(message, target, category);
    }

    async techInformation(message, member, cat) {
        const categoryName = cat;

        if (categoryName)
            return await this.displayCategory(message, member, categoryName);

        return await this.displayAll(message, member);
    }

    displayAll = async (message, member) => {
        let embed = new MessageEmbed().setColor("RANDOM");
        embed.setTitle(`**Player: ${member.name} **`);

        const memberTechsArray = member.techs.filter(t => t.level > 0).sort((a, b) => a.name > b.name ? 1 : -1);

        if (memberTechsArray.length) {
            const memberTechs = new Map(memberTechsArray.map(t => [t.name, t]));

            const temp = [...TechTree.categories.values()]
                .filter(category => memberTechsArray.some(t => category.has(t.name)))
                .sort((a, b) => a.name > b.name ? 1 : -1)
                .map(category => [
                    `*${category.name}*`,
                    Array.from(category.get().values())
                        .filter(t => memberTechs.has(t.name))
                        .map(t => `${t.name} ${memberTechs.get(t.name).level}`)
                ])
                .forEach(categoryData => embed.addField(categoryData[0], categoryData[1]));
        }
        else embed.setDescription("No techs were found!");

        return message.channel.send(embed);
    }

    displayCategory = async (message, member, categoryName) => {
        const category = TechTree.findCategory(categoryName);
        if (!await confirmTech(message, categoryName, category))
            return;

        let embed = new MessageEmbed().setColor("RANDOM");
        embed.setTitle(`**Player: ${member.name} **`);

        const memberTechs = new Map(member.techs.filter(t => t.level > 0).map(t => [t.name, t]).sort((a, b) => a.name > b.name ? 1 : -1));

        if (memberTechs.size) {
            embed.addField(
                `*${category.name}*`,
                [...category.get().values()]
                    .sort((a, b) => a.name > b.name ? 1 : -1)
                    .filter(tech => memberTechs.has(tech.name))
                    .map(tech => `${tech.name} ${memberTechs.get(tech.name).level}`)
                    .join('\n')
            );
        }
        else embed.setDescription("No techs were found!");

        return message.channel.send(embed);
    }
}