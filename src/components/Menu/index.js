import React from 'react'
import MenuItem from '../MenuItem'

export default class Menu extends React.Component {
  constructor () {
    super()

    this.state = {
      height: 0,
      marginTop: -10,
      opacity: 0,
      top: 0,
      left: 0
    }

    this.menuItems = []
  }

  show = () => {
    let separatorsCount = document.getElementsByClassName('menu-separator').length
    let topBottomPadding = 24
    let separatorsMargins = 16
    let navIconsHeight = 48
    let height = navIconsHeight + separatorsCount + separatorsCount * separatorsMargins + topBottomPadding
    for (var i = 0; i < this.menuItems.length; i++) {
      if (this.menuItems[i].shown) {
        height += 32
      }
    }

    this.setState(
      {
        marginTop: 0,
        opacity: 1,
        height: height
      }
    )
  }

  hide = () => {
    this.setState(
      {
        marginTop: -10,
        opacity: 0,
        height: 0
      }
    )
  }

  getMenu = () => {
    return this
  }

  render () {
    let menuStyle = {
      height: this.state.height,
      marginTop: this.state.marginTop,
      opacity: this.state.opacity,
      top: this.state.top,
      left: this.state.left
    }

    return (
      <div ref='menu' className='menu' style={menuStyle}>
        <div className='navigation-icons'>
          <div className='navigation-icon-back' />
          <div className='navigation-icon-forward' />
          <div className='navigation-icon-refresh' />
          <div className='navigation-icon-star' />
        </div>
        <div className='menu-line' />
        <div className='menu-items'>
          <MenuItem getMenu={this.getMenu}>
            Open link in new tab
          </MenuItem>
          <div className='menu-separator' />
          <MenuItem getMenu={this.getMenu}>
            Copy link address
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            Save link as
          </MenuItem>
          <div className='menu-separator' />
          <MenuItem getMenu={this.getMenu}>
            Open image in new tab
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            Save image as
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            Copy image
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            Copy image address
          </MenuItem>
          <div className='menu-separator' />
          <MenuItem getMenu={this.getMenu}>
            Print
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            View source
          </MenuItem>
          <MenuItem getMenu={this.getMenu}>
            Inspect element
          </MenuItem>
        </div>
      </div>
    )
  }
}