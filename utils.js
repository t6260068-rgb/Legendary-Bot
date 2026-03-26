const { PermissionFlagsBits } = require("discord.js");

const STAFF_ROLES = ["Legend Server Staff", "Legend Moderator"];

function hasPermission(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some((role) => STAFF_ROLES.includes(role.name));
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

module.exports = { hasPermission, parseDuration };
