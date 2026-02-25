const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const baseline = require('./baseline');
const config = require('../config');

const OWNER_ROLE_ID = config.OWNER_ROLE_ID;

function hasOwnerPermission(member) {
  if (!member) return false;
  if (member.id === member.guild?.ownerId) return true;
  return member.roles.cache.has(OWNER_ROLE_ID);
}

function registerCommands(client) {
  const guildId = config.GUILD_ID;

  const commands = [
    new SlashCommandBuilder()
      .setName('impersonation')
      .setDescription('Anti-impersonation controls (owner only)')
      .addSubcommand((s) => s.setName('status').setDescription('Show threshold, enforce, dry run, counts'))
      .addSubcommand((s) =>
        s.setName('threshold').setDescription('Set edit distance threshold').addIntegerOption((o) => o.setName('value').setDescription('1 = one char diff').setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName('enforce')
          .setDescription('Turn enforcement on or off')
          .addStringOption((o) => o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
      )
      .addSubcommand((s) => s.setName('refresh').setDescription('Force refresh protected baseline'))
      .addSubcommand((s) =>
        s
          .setName('protect')
          .setDescription('Manually add/remove protected user')
          .addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
          .addStringOption((o) => o.setName('user').setDescription('User ID').setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName('ignore-role')
          .setDescription('Add/remove role to ignore')
          .addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
          .addStringOption((o) => o.setName('role').setDescription('Role ID').setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName('dryrun')
          .setDescription('Toggle dry run (log only, no ban)')
          .addStringOption((o) => o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
      ),
  ].map((c) => c.toJSON());

  return client.application.commands.set(commands, guildId);
}

async function handleInteraction(client, interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'impersonation') return;
  if (interaction.guildId !== config.GUILD_ID) return;

  const member = interaction.member;
  if (!hasOwnerPermission(member)) {
    return interaction.reply({ content: 'Only the server owner or users with the Owner role can use this.', ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const threshold = db.getSetting('threshold') ?? '1';
    const enforce = db.getSetting('enforce') ?? 'true';
    const dryRun = db.getSetting('dry_run') ?? 'false';
    const protectedIds = baseline.getProtectedUserIds();
    const handles = baseline.getProtectedHandles();
    const ignoredRoles = db.getIgnoredRoleIds();
    await interaction.reply({
      ephemeral: true,
      content: [
        `**Impersonation status**`,
        `Threshold: \`${threshold}\` (edit distance)`,
        `Enforce: \`${enforce}\``,
        `Dry run (log only): \`${dryRun}\``,
        `Protected users: ${protectedIds.size}`,
        `Protected handles: ${handles.length}`,
        `Ignored roles: ${ignoredRoles.length}`,
      ].join('\n'),
    });
    return;
  }

  if (sub === 'threshold') {
    const value = interaction.options.getInteger('value');
    if (value < 0 || value > 10) return interaction.reply({ content: 'Threshold must be 0–10.', ephemeral: true });
    db.setSetting('threshold', value);
    return interaction.reply({ content: `Threshold set to \`${value}\`.`, ephemeral: true });
  }

  if (sub === 'enforce') {
    const mode = interaction.options.getString('mode');
    db.setSetting('enforce', mode === 'on' ? 'true' : 'false');
    return interaction.reply({ content: `Enforcement \`${mode}\`.`, ephemeral: true });
  }

  if (sub === 'dryrun') {
    const mode = interaction.options.getString('mode');
    db.setSetting('dry_run', mode === 'on' ? 'true' : 'false');
    return interaction.reply({ content: `Dry run \`${mode}\` (log only, no ban).`, ephemeral: true });
  }

  if (sub === 'refresh') {
    await baseline.refresh(client);
    return interaction.reply({ content: 'Protected baseline refreshed.', ephemeral: true });
  }

  if (sub === 'protect') {
    const action = interaction.options.getString('action');
    const userId = interaction.options.getString('user').trim();
    if (action === 'add') {
      db.addManualProtected(userId);
      return interaction.reply({ content: `Added \`${userId}\` to protected list.`, ephemeral: true });
    }
    db.removeManualProtected(userId);
    return interaction.reply({ content: `Removed \`${userId}\` from protected list. Run \`/impersonation refresh\` to update.`, ephemeral: true });
  }

  if (sub === 'ignore-role') {
    const action = interaction.options.getString('action');
    const roleId = interaction.options.getString('role').trim();
    if (action === 'add') {
      db.addIgnoredRole(roleId);
      return interaction.reply({ content: `Added role \`${roleId}\` to ignore list.`, ephemeral: true });
    }
    db.removeIgnoredRole(roleId);
    return interaction.reply({ content: `Removed role \`${roleId}\` from ignore list.`, ephemeral: true });
  }
}

module.exports = { registerCommands, handleInteraction };
