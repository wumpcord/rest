# @wumpcord/rest
> 🥀 **Standalone package for Discord's REST and CDN for Wumpcord**

## Usage
```ts
import { RestClient, CDN, DiscordRestError, DiscordAPIError } from '@wumpcord/rest';
import { readFileSync } from 'fs';

// CDN
CDN.getDefaultAvatar('5820'); //=> 'https://cdn.discordapp.com/embed/avatars/0.png'
CDN.getUserAvatar('280158289667555328', 'f788c8a8993bc702824700eda5623795'); //=> 'https://cdn.discordapp.com/avatars/280158289667555328/...'

// Rest
const rest = new RestClient('bot token');
rest.dispatch({
  endpoint: '/channels/:id/messages',
  method: 'POST',
  query: {
    id: '794102278004932648'
  },
  data: {
    content: 'Hello, world!'
  },
  file: {
    file: readFileSync('./path/to/some/file.png'),
    name: 'file.png'
  }
}).then(message => {
  // `message` => https://discord.com/developers/docs/resources/channel#message-object
}).catch((error) => {
  // uh oh! we received a error, what do we do???

  // Maybe it's a REST error?
  if (error instanceof DiscordRestError) {
    // `error` => DiscordRestError
  }

  // Maybe it's an API error?
  if (error instanceof DiscordAPIError) {
    // `error` => DiscordAPIError
  }

  // I guess it's none of those 3, how can it happen?
  console.error(error);
});
```
