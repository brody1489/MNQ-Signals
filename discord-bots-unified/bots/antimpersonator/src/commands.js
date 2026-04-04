const { SlashCommandBuilder } = require('discord.js');
const db = require('./db');
const baseline = require('./baseline');
const config = require('../config');

function hasOwnerPermission(member) {
  if (!member) return false;
  if (member.id === member.guild?.ownerId) return true;
  return member.roles.cache.has(config.OWNER_ROLE_ID);
}

function registerCommands(client) {
  const guildId = config.GUILD_ID;
  const commands = [
    new SlashCommandBuilder()
      .setName('impersonation')
      .setDescription('Anti-impersonation controls (owner only)')
      .addSubcommand((s) => s.setName('status').setDescription('Show threshold, enforce, dry run, counts'))
      .addSubcommand((s) => s.setName('threshold').setDescription('Set edit distance threshold').addIntegerOption((o) => o.setName('value').setDescription('1 = one char diff').setRequired(true)))
      .addSubcommand((s) => s.setName('enforce').setDescription('Turn enforcement on or off').addStringOption((o) => o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })))
      .addSubcommand((s) => s.setName('refresh').setDescription('Force refresh protected baseline'))
      .addSubcommand((s) => s.setName('protect').setDescription('Manually add/remove protected user').addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })).addStringOption((o) => o.setName('user').setDescription('User ID').setRequired(true)))
      .addSubcommand((s) => s.setName('ignore-role').setDescription('Add/remove role to ignore').addStringOption((o) => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })).addStringOption((o) => o.setName('role').setDescription('Role ID').setRequired(true)))
      .addSubcommand((s) => s.setName('dryrun').setDescription('Toggle dry run (log only, no ban)').addStringOption((o) => o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })))
      .addSubcommand((s) => s.setName('message-mod').setDescription('Toggle message mod (scam/spam delete)').addStringOption((o) => o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })))
      .addSubcommand((s) =>
        s
          .setName('display-match')
          .setDescription('Toggle display-name / bio impersonation checks')
          .addStringOption((o) =>
            o.setName('mode').setDescription('On or off').setRequired(true).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })
          )
      )
      .addSubcommand((s) =>
        s
          .setName('display-threshold')
          .setDescription('Display clone path: max display-name edits (also needs handle + same PFP)')
          .addIntegerOption((o) => o.setName('value').setDescription('0 = exact normalized display').setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName('display-handle-max')
          .setDescription('Display clone path: max @username edits vs protected (with display + PFP)')
          .addIntegerOption((o) => o.setName('value').setDescription('e.g. 3').setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName('display-min-len')
          .setDescription('Minimum normalized length for display-name rules (avoid short names)')
          .addIntegerOption((o) => o.setName('value').setDescription('e.g. 5').setRequired(true))
      ),
  ].map((c) => c.toJSON());
  return client.application.commands.set(commands, guildId);
}

async function handleInteraction(client, interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'impersonation') return;
  if (interaction.guildId !== config.GUILD_ID) return;
  if (!hasOwnerPermission(interaction.member)) {
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
    const msgMod = db.getSetting('message_mod') ?? 'true';
    const displayMatch = db.getSetting('display_match') ?? 'true';
    const displayTh = db.getSetting('display_threshold') ?? '1';
    const displayHandleMax = db.getSetting('display_handle_max') ?? '3';
    const displayMinLen = db.getSetting('display_min_len') ?? '5';
    return interaction.reply({
      ephemeral: true,
      content: [
        '**Impersonation status**',
        `Username threshold: \`${threshold}\``,
        `Display checks: \`${displayMatch}\` (handle + display + PFP)`,
        `Display threshold: \`${displayTh}\` · handle max: \`${displayHandleMax}\` · min len: \`${displayMinLen}\``,
        `Enforce: \`${enforce}\``,
        `Dry run: \`${dryRun}\``,
        `Message mod: \`${msgMod}\``,
        `Protected users: ${protectedIds.size}`,
        `Protected handles: ${handles.length}`,
        `Ignored roles: ${ignoredRoles.length}`,
      ].join('\n'),
    });
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
    return interaction.reply({ content: `Dry run \`${mode}\`.`, ephemeral: true });
  }
  if (sub === 'message-mod') {
    const mode = interaction.options.getString('mode');
    db.setSetting('message_mod', mode === 'on' ? 'true' : 'false');
    return interaction.reply({ content: `Message mod \`${mode}\`.`, ephemeral: true });
  }
  if (sub === 'refresh') {
    await baseline.refresh(client);
    return interaction.reply({ content: 'Protected baseline refreshed.', ephemeral: true });
  }
  if (sub === 'protect') {
    const action = interaction.options.getString('action');
    const userId = interaction.options.getString('user').trim();
    if (action === 'add') db.addManualProtected(userId); else db.removeManualProtected(userId);
    return interaction.reply({ content: action === 'add' ? `Added \`${userId}\` to protected list.` : `Removed \`${userId}\`. Run /impersonation refresh to update.`, ephemeral: true });
  }
  if (sub === 'ignore-role') {
    const action = interaction.options.getString('action');
    const roleId = interaction.options.getString('role').trim();
    if (action === 'add') db.addIgnoredRole(roleId); else db.removeIgnoredRole(roleId);
    return interaction.reply({ content: `Role \`${roleId}\` ${action === 'add' ? 'added to' : 'removed from'} ignore list.`, ephemeral: true });
  }
  if (sub === 'display-match') {
    const mode = interaction.options.getString('mode');
    db.setSetting('display_match', mode === 'on' ? 'true' : 'false');
    return interaction.reply({ content: `Display-name checks \`${mode}\`.`, ephemeral: true });
  }
  if (sub === 'display-threshold') {
    const value = interaction.options.getInteger('value');
    if (value < 0 || value > 5) return interaction.reply({ content: 'Display threshold must be 0–5.', ephemeral: true });
    db.setSetting('display_threshold', String(value));
    return interaction.reply({ content: `Display threshold set to \`${value}\`.`, ephemeral: true });
  }
  if (sub === 'display-handle-max') {
    const value = interaction.options.getInteger('value');
    if (value < 1 || value > 8) return interaction.reply({ content: 'Display handle max must be 1–8 (edit distance on @username vs protected).', ephemeral: true });
    db.setSetting('display_handle_max', String(value));
    return interaction.reply({ content: `Display clone path: max handle distance set to \`${value}\`.`, ephemeral: true });
  }
  if (sub === 'display-min-len') {
    const value = interaction.options.getInteger('value');
    if (value < 3 || value > 32) return interaction.reply({ content: 'Display min length must be 3–32.', ephemeral: true });
    db.setSetting('display_min_len', String(value));
    return interaction.reply({ content: `Display min length set to \`${value}\`.`, ephemeral: true });
  }
}

module.exports = { registerCommands, handleInteraction };
