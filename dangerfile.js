const PR_NUMBER = danger.github.pr.number;
const PR_AUTHOR   = danger.github.pr.user.login;
const PR_URL = danger.github.pr.html_url;
const PR_LINK = `. (#${PR_NUMBER}) @${PR_AUTHOR}`;

const github = require("@actions/github");
const octokit = new github.GitHub(process.env.GITHUB_TOKEN);
const perms = ["none", "read", "write", "admin"];

const username  = github.context.actor;
async function HasCommentPermission()
{
  const response = await octokit.repos.getCollaboratorPermissionLevel({
    ...github.context.repo,
    username: username
  });

  let permission = response.data.permission; // Permission level of actual user
  let argPerm = core.getInput("permission"); // Permission level passed in through args

  let yourPermIdx = perms.indexOf(permission);
  let requiredPermIdx = perms.indexOf(argPerm);

  core.debug(`[Action] User Permission: ${permission}`);
  core.debug(`[Action] Minimum Action Permission: ${argPerm}`);

  // If the index of your permission is at least or greater than the required,
  // exit successfully. Otherwise fail.
  if (yourPermIdx >= requiredPermIdx) 
  {
	console.log("no permission");
    return false;
  } 
  else 
  {
	console.log("has permission");
    return true;
  }
}


const CHANGELOG_SUMMARY_TITLE = `Instructions and example for changelog`;
const CHANGELOG_BODY = `Please add an entry to \`CHANGELOG.md\` to the "Unreleased" section under the following heading:
 1. **Feat**: For new user-visible functionality.
 2. **Fix**: For user-visible bug fixes.
 3. **Ref**: For features, refactors and bug fixes in internal operation.

To the changelog entry, please add a link to this PR (consider a more descriptive message):`;

const CHANGELOG_END_BODY = `If none of the above apply, you can opt out by adding _#skip-changelog_ to the PR description.`;

function getCleanTitleWithPrLink() {
  const title = danger.github.pr.title;
  return title.split(": ").slice(-1)[0].trim().replace(/\.+$/, "") + PR_LINK;
}

function getChangelogDetailsHtml() {
  return `
<details>
<summary><b>\`${CHANGELOG_SUMMARY_TITLE}\`$</b></summary>

\`${CHANGELOG_BODY}\`

\`\`\`md
- ${getCleanTitleWithPrLink()}
\`\`\`

\`${CHANGELOG_END_BODY}\`
</details>
`;
}

function getChangelogDetailsTxt() {
	return CHANGELOG_SUMMARY_TITLE + '\n' +
		   CHANGELOG_BODY + '\n' +
		   getCleanTitleWithPrLink() + '\n' +
		   CHANGELOG_END_BODY;
}

async function containsChangelog(path) {
  const contents = await danger.github.utils.fileContents(path);
  return contents.includes(PR_LINK);
}

async function checkChangelog() {
  const skipChangelog =
    danger.github && (danger.github.pr.body + "").includes("#skip-changelog");
  if (skipChangelog) {
    return;
  }

  const hasChangelog = await containsChangelog("CHANGELOG.md");

  if (!hasChangelog) {
    fail("Please consider adding a changelog entry for the next release.");
	try
	{
		if(await HasCommentPermission()){
			markdown(getChangelogDetailsHtml());
		}
		else
		{
			//Fallback
			console.log(getChangelogDetailsTxt());
		}
	}
  }
}

async function checkIfFeature() {
   const title = danger.github.pr.title;
   if(title.startsWith('feat:')){
		if(await HasCommentPermission()){
			 message('Do not forget to update <a href="https://github.com/getsentry/sentry-docs">Sentry-docs</a> with your feature once the pull request gets approved.');
		}
   }  
}

async function checkAll() {
  // See: https://spectrum.chat/danger/javascript/support-for-github-draft-prs~82948576-ce84-40e7-a043-7675e5bf5690
  const isDraft = danger.github.pr.mergeable_state === "draft";

  if (isDraft) {
    return;
  }

  await checkIfFeature();
  await checkChangelog();
}

schedule(checkAll);
