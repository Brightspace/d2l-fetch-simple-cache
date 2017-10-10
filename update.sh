#!/bin/bash
set -e

if ! [ "$TRAVIS_BRANCH" == "master" ] || ! [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
	echo "Version is only bumped on master"
	exit 0
fi

lastVersion=$(git describe --abbrev=0)
versionRegex='^([0-9]+)\.([0-9]+)\.([0-9]+)$'
if ! [[ $lastVersion =~ $versionRegex ]]; then
	echo $lastVersion "is not a valid semver string"
	exit 1
fi

majorVersion=${BASH_REMATCH[1]}
minorVersion=${BASH_REMATCH[2]}
patchVersion=${BASH_REMATCH[3]}

lastLogMessage=$(git log -1 --pretty=format:%s%b)
lastLogMessageShort=$(git log -1 --pretty=format:%s)

majorRegex='\[increment major\]'
patchRegex='\[increment patch\]'
if [[ $lastLogMessage =~ $majorRegex ]]; then
	majorVersion=$((majorVersion + 1))
	minorVersion=0
	patchVersion=0
elif [[ $lastLogMessage =~ $patchRegex ]]; then
	patchVersion=$((patchVersion + 1))
else
	minorVersion=$((minorVersion + 1))
	patchVersion=0
fi

newVersion="${majorVersion}.${minorVersion}.${patchVersion}"

# Add the upstream using GITHUB_RELEASE_TOKEN
git remote add upstream "https://${GITHUB_RELEASE_TOKEN}@github.com/Brightspace/d2l-fetch-simple-cache.git"

# Pull the merge commit
git pull upstream master
git checkout upstream/master

# Set config so this commit shows up as coming from Travis
git config --global user.email "travis@travis-ci.com"
git config --global user.name "Travis CI"

echo "Updating from ${lastVersion} to ${newVersion}"
echo "<!-- CHANGES TO THIS FILE WILL BE LOST - IT IS AUTOMATICALLY GENERATED WHEN d2l-fetch-simple-cache IS RELEASED -->" > d2l-fetch-simple-cache.html
echo "<script src=\"https://s.brightspace.com/lib/d2lfetch-simple-cache/"$newVersion"/d2lfetch-simple-cache.js\"></script>" >> d2l-fetch-simple-cache.html

# Add the updated d2l-fetch-simple-cache.html, and add a new tag to create the release
git add .
git commit -m "[skip ci] Update to ${newVersion}"
git tag -a ${newVersion} -m "${newVersion} - ${lastLogMessageShort}"

git status

git push upstream HEAD:master --tags

# Publish the release via frau-publisher
export TRAVIS_TAG=$newVersion
npm run publish-release
