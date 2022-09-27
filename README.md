# Adjaceny Map

TODO: describe why this exists

## Installing

Install npm.

Check out this repo.

Run `npm install` to install dependencies.

### Installing on Apple Silicon

The machinery to do screenshotting relies on a library that doesn't install cleanly on Apple Silicon.

Can get everything but screenshots running with `npm install --only=prod`

Install homebrew if not already installed

Run `arch -arm64 brew install pkg-config cairo pango libpng jpeg giflib librsvg`

Then run `npm install canvas` and `npm install`

## Running

Run `npm run start` from command line.

Visit http://localhost:8081

Arrow keys left or right to move forward or backward in state. Spacebar toggles play/pause.

The main config that will be loaded up is `data/default.json`. You can also create additional config files in that directory, and load them by changing the `default` in the URL to be the filename of the json file you want to load.

Run `npm run screenshots` to generate screenshots, one for each state in your `data/default.json`, blowing away whatever was in the screenshots/ directory.

If you only want to generate the screenshots, not the gifs, run `npm run screenshots:png`. If you only want to generate the gifs based on already-generated screenshots, run `npm run screenshots:gif`.

## Deploying

If you want to deploy to firebase hosting, set up a firebase project. Then run `firebase use <PROJECT-ID>`.

Now, you can deploy whenever you want to:

`npm run deploy`

Your web app will now be available at `https://<PROJECT-ID>.web.app/`