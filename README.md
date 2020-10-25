# node-zanarkand-proto
A WIP Node.js wrapper for acchan's [Zanarkand](https://github.com/ayyaruq/zanarkand) network capture library.

Many features are unimplemented, and chat-related messages aren't completely working, but besides that what is implemented is probably usable.

If you so choose, you can use it exclusively as a wrapper for Zanarkand with minimal data processing by assigning the `raw` data event as shown below.

Event type names and all packet structures are taken from the [Sapphire](https://github.com/SapphireServer/Sapphire) project.

NOTE: Most features besides the `raw` data event will break after every patch release until the [IPC opcodes](https://github.com/SapphireServer/Sapphire/blob/develop/src/common/Network/PacketDef/Ipcs.h) are updated in the Sapphire repo.

## Installation
```
npm install node-zanarkand-proto
```

If you don't trust the copy of ZanarkandWrapperJSON that is built in the Github Action, feel free to also install Go to build [ZanarkandWrapperJSON](https://github.com/karashiiro/ZanarkandWrapperJSON) and place the output in the Zanarkand folder.